import { exportMyData } from '@/api/storywallApi';

// "Download my data" (Settings → Account): saves everything StoryWall stores
// about the user as one JSON file (see exportMyData for what's in it).
export async function downloadMyData() {
  const data = await exportMyData();
  const name = data.profile?.username || 'account';
  const day = data.exported_at.slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `storywall-data-${name}-${day}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before freeing the file.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
