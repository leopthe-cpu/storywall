import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Generates an image from a text prompt using the platform's built-in
// GenerateImage integration. Returns { url: string } on success.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return Response.json({ error: 'Missing prompt' }, { status: 400 });
    if (prompt.length > 2000) return Response.json({ error: 'Prompt too long' }, { status: 400 });

    // Optional reference image (public URL) for Qwen-Image-3.0 image-to-image
    const referenceImage = typeof body?.referenceImage === 'string' ? body.referenceImage.trim() : '';
    const genArgs = referenceImage
      ? { prompt, existing_image_urls: [referenceImage] }
      : { prompt };

    const result = await base44.asServiceRole.integrations.Core.GenerateImage(genArgs);
    const imageUrl = result?.url;

    if (!imageUrl) {
      console.error('[generateImage] No image URL in response:', JSON.stringify(result));
      return Response.json({ error: 'No image returned' }, { status: 502 });
    }

    return Response.json({ url: imageUrl });
  } catch (error) {
    console.error('[generateImage] error:', error?.message || error);
    return Response.json({ error: error?.message || 'Image generation failed' }, { status: 500 });
  }
}