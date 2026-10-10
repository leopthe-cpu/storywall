#!/usr/bin/env python3
"""One-off import of a Base44 account into the new Supabase app (decision 7).

Reads JSON exported from Base44 (read-only queries) and writes it to a
Supabase project as the target user, through the same API and access rules
the app uses (no admin key needed):

  - profile fields, and the username through the setUsername function;
  - every story (drafts, published, archived) with its cards stored whole;
  - story notes (raw_notes) into the owner-only post_notes table;
  - media files: copied into the user's own folder in the public-media
    bucket, and every reference in cards, cover images and the profile
    picture rewritten to the copy, so nothing keeps pointing at Base44;
  - the media library (one row per copied file, via registerMedia).

Files it cannot fetch are left as they are and listed in the report, never
dropped silently. Re-running is safe: copies are keyed by the source URL and
stories already imported (by Base44 id, kept in the report) are skipped.

Usage:
  python3 scripts/import_base44.py --export-dir DIR --report report.json
Inputs in DIR: posts.json ({"entities": [...]} as Base44 returns it),
profile.json (one User record), optional media.json ({"entities": [...]}).
Environment: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, IMPORT_EMAIL,
IMPORT_PASSWORD (the target account). Never prints the password or tokens.
"""
import argparse
import hashlib
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BUCKET = 'public-media'
POST_FIELDS = [
    'title', 'status', 'cards', 'color_tokens', 'cover_image', 'tags', 'display_order',
    'ai_generated', 'generation_style', 'skill_refresh_count', 'skill_refresh_date',
]
PROFILE_FIELDS = [
    'full_name', 'display_name', 'headline', 'bio', 'location', 'profile_image', 'skills',
    'links', 'is_private',
]


class Api:
    def __init__(self, url, key):
        self.url, self.key, self.token, self.user_id = url.rstrip('/'), key, None, None

    def call(self, method, path, body=None, headers=None, raw=None, content_type='application/json'):
        h = {'apikey': self.key, **(headers or {})}
        if self.token:
            h['authorization'] = f'Bearer {self.token}'
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        if data is not None:
            h['content-type'] = content_type
        req = urllib.request.Request(self.url + path, data=data, headers=h, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                text = r.read().decode() or 'null'
                return r.status, json.loads(text)
        except urllib.error.HTTPError as e:
            text = e.read().decode()
            try:
                return e.code, json.loads(text)
            except ValueError:
                return e.code, text[:300]

    def sign_in(self, email, password):
        st, res = self.call('POST', '/auth/v1/token?grant_type=password', {'email': email, 'password': password})
        if st != 200:
            sys.exit(f'sign-in failed: HTTP {st}')
        self.token, self.user_id = res['access_token'], res['user']['id']


def fetch(url):
    req = urllib.request.Request(url, headers={'user-agent': 'storywall-import'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read(), r.headers.get('content-type', '').split(';')[0]


def is_media_ref(v):
    """Base44 file references: hosted URLs or private 'mp/private/...' paths."""
    return isinstance(v, str) and (
        v.startswith('https://media.base44.com/') or v.startswith('https://base44.app/api/apps/')
        or v.startswith('mp/private/') or v.startswith('mp/public/'))


def walk_strings(value, fn):
    """Applies fn to every string inside nested lists/dicts, returns the copy."""
    if isinstance(value, str):
        return fn(value)
    if isinstance(value, list):
        return [walk_strings(v, fn) for v in value]
    if isinstance(value, dict):
        return {k: walk_strings(v, fn) for k, v in value.items()}
    return value


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--export-dir', required=True)
    ap.add_argument('--report', required=True)
    args = ap.parse_args()
    d = args.export_dir
    posts = json.load(open(os.path.join(d, 'posts.json')))['entities']
    profile = json.load(open(os.path.join(d, 'profile.json')))
    media_path = os.path.join(d, 'media.json')
    media_rows = json.load(open(media_path))['entities'] if os.path.exists(media_path) else []

    api = Api(os.environ['SUPABASE_URL'], os.environ['SUPABASE_PUBLISHABLE_KEY'])
    api.sign_in(os.environ['IMPORT_EMAIL'], os.environ['IMPORT_PASSWORD'])
    report = json.load(open(args.report)) if os.path.exists(args.report) else {}
    report.setdefault('posts', {})
    report['copied'], report['not_copied'] = {}, {}

    # 1. Every Base44 file reference anywhere in the data.
    refs = set()
    def collect(v):
        if is_media_ref(v):
            refs.add(v)
        return v
    walk_strings(posts, collect)
    walk_strings(profile, collect)
    walk_strings(media_rows, collect)

    # 2. Copy each file once into the user's own folder.
    mapping = {}
    for ref in sorted(refs):
        if ref.startswith('mp/'):
            report['not_copied'][ref] = 'private Base44 file: needs a signed link from Base44'
            continue
        try:
            data, ctype = fetch(ref)
        except Exception as e:  # noqa: BLE001 - every failure is reported, none hidden
            report['not_copied'][ref] = f'download failed: {type(e).__name__}: {e}'[:200]
            continue
        name = os.path.basename(urllib.parse.urlparse(ref).path) or 'file'
        ext = os.path.splitext(name)[1] or mimetypes.guess_extension(ctype) or ''
        path = f'{api.user_id}/imported/{hashlib.sha1(ref.encode()).hexdigest()[:16]}{ext}'
        st, res = api.call('POST', f'/storage/v1/object/{BUCKET}/{path}', raw=data,
                           headers={'x-upsert': 'true'}, content_type=ctype or 'application/octet-stream')
        if st not in (200, 201):
            report['not_copied'][ref] = f'upload failed: HTTP {st} {res}'[:200]
            continue
        mapping[ref] = f'{api.url}/storage/v1/object/public/{BUCKET}/{path}'
        report['copied'][ref] = mapping[ref]
    swap = lambda v: mapping.get(v, v)  # noqa: E731

    # 3. Profile and username.
    fields = {k: walk_strings(profile.get(k), swap) for k in PROFILE_FIELDS if k in profile}
    fields['is_private'] = bool(profile.get('is_private'))
    st, res = api.call('PATCH', f'/rest/v1/profiles?id=eq.{api.user_id}', fields, {'prefer': 'return=minimal'})
    report['profile'] = 'ok' if st in (200, 204) else f'HTTP {st} {res}'
    if profile.get('username'):
        st, res = api.call('POST', '/functions/v1/setUsername', {'username': profile['username']})
        report['username'] = 'ok' if st == 200 else f'HTTP {st} {res}'

    # 4. Stories and their notes.
    for p in posts:
        if p['id'] in report['posts']:
            continue
        row = {k: walk_strings(p.get(k), swap) for k in POST_FIELDS if p.get(k) is not None}
        if isinstance(row.get('display_order'), float):
            row['display_order'] = int(row['display_order'])
        row['created_at'], row['updated_at'] = p.get('created_date'), p.get('updated_date')
        st, res = api.call('POST', '/rest/v1/posts', row, {'prefer': 'return=representation'})
        if st != 201:
            report['posts'][p['id']] = {'error': f'HTTP {st} {res}'[:300]}
            continue
        new_id = res[0]['id']
        report['posts'][p['id']] = {'id': new_id}
        if p.get('raw_notes'):
            st, res = api.call('POST', '/rest/v1/post_notes', {'post_id': new_id, 'raw_notes': p['raw_notes']},
                               {'prefer': 'return=minimal'})
            if st != 201:
                report['posts'][p['id']]['notes_error'] = f'HTTP {st} {res}'[:300]

    # 5. Media library: one row per copied file (registerMedia is idempotent).
    types = {r.get('image_url'): r.get('media_type') or 'image' for r in media_rows}
    report['media_rows'] = 0
    for ref, url in mapping.items():
        st, _ = api.call('POST', '/functions/v1/registerMedia',
                         {'image_url': url, 'media_type': types.get(ref, 'image')})
        report['media_rows'] += st == 200

    json.dump(report, open(args.report, 'w'), indent=2, ensure_ascii=False)
    ok = sum(1 for v in report['posts'].values() if 'id' in v)
    print(f"stories imported: {ok}/{len(posts)} | files copied: {len(report['copied'])} | "
          f"not copied: {len(report['not_copied'])} | media rows: {report['media_rows']} | "
          f"profile: {report['profile']} | username: {report.get('username')}")


if __name__ == '__main__':
    main()
