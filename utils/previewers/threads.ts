import { logger } from "../logger.ts";
import { decodeHtmlEntities } from "../html_utils.ts";
import { ComponentV2Type } from "../components_v2.ts";

export const THREADS_REGEX =
  /https?:\/\/(?:www\.)?(?:threads\.net|threads\.com)\/@([a-zA-Z0-9_.]+)\/post\/([A-Za-z0-9_]+)(?:\?[^\s#]+)?/;

export interface ThreadInfo {
  url: string;
  text: string;
  author: {
    name: string;
    username: string;
    avatar_url: string;
  };
  media: {
    type: "photo" | "video";
    url: string;
    thumbnail_url?: string;
  }[];
  stats: {
    replies: number;
    reblogs: number;
    likes: number;
  };
  created_at: string;
}

export async function getThreadsPreview(content: string) {
  const match = content.match(THREADS_REGEX);
  if (!match) return null;

  const username = match[1];
  const postId = match[2];
  const url = `https://fixthreads.seria.moe/@${username}/post/${postId}`;

  logger.debug("Fetching Threads URL: {url}", { url });

  try {
    const res = await fetch(url);
    const html = await res.text();

    // Parse OG meta tags - extract ALL matches for multi-media support
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);

    // Extract ALL og:image tags (for carousels with multiple images)
    const ogImageMatches = [...html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)];
    const ogImageAltMatches = [...html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi)];
    const allImages = [
      ...ogImageMatches.map((m) => m[1]),
      ...ogImageAltMatches.map((m) => m[1]),
    ];

    // Extract ALL og:video tags (for posts with videos)
    const ogVideoMatches = [...html.matchAll(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/gi)];
    const ogVideoAltMatches = [...html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video["']/gi)];
    const allVideos = [
      ...ogVideoMatches.map((m) => m[1]),
      ...ogVideoAltMatches.map((m) => m[1]),
    ];

    const ogTitle = ogTitleMatch ? decodeHtmlEntities(ogTitleMatch[1]) : "";
    const ogDescription = ogDescMatch ? decodeHtmlEntities(ogDescMatch[1]) : "";

    logger.debug("Threads OG Data: title: {title}, images: {imgCount}, videos: {vidCount}", {
      title: ogTitle,
      imgCount: allImages.length,
      vidCount: allVideos.length,
    });

    // Build media items for gallery - add ALL images and videos
    const mediaItems: { media: { url: string; thumbnail?: { url: string } }; spoiler: boolean }[] = [];

    // Add all images first
    for (const imageUrl of allImages) {
      mediaItems.push({
        media: {
          url: imageUrl,
        },
        spoiler: false,
      });
    }

    // Add all videos (with thumbnail if we have extra images beyond the first)
    for (const videoUrl of allVideos) {
      // Use second image as thumbnail if available (first image already shown separately)
      const thumbnail = allImages.length > 1 ? allImages[1] : undefined;
      mediaItems.push({
        media: {
          url: videoUrl,
          thumbnail: thumbnail ? { url: thumbnail } : undefined,
        },
        spoiler: false,
      });
    }

    // Truncate text if too long
    const truncatedText = ogDescription.length > 200
      ? ogDescription.substring(0, 197) + "..."
      : ogDescription;

    // Build "View on Threads" link
    const originalThreadsUrl = match[0].split("?")[0]; // Remove query params

    return {
      color: 0x000000,
      isNSFW: false,
      components: [
        // Author Header (just username, no redundant "on Threads")
        {
          type: ComponentV2Type.TextDisplay,
          content: `**@${username}**`,
        },
        // Content Text (use ogDescription, skip if ogTitle is just duplicate username info)
        ...(ogDescription && ogDescription !== ogTitle
          ? [{
            type: ComponentV2Type.TextDisplay,
            content: truncatedText,
          }]
          : []),
        // Media Gallery (if any)
        ...(mediaItems.length > 0
          ? [{
            type: ComponentV2Type.MediaGallery,
            items: mediaItems,
          }]
          : []),
        // View on Threads link
        {
          type: ComponentV2Type.TextDisplay,
          content: `[View on Threads](${originalThreadsUrl})`,
        },
      ],
    };
  } catch (error) {
    logger.error("Failed to fetch Threads info: {error}", { error });

    // Fallback: return original Threads URL so user can still access it
    const originalUrl = match[0].split("?")[0]; // Remove query params
    return {
      color: 0x000000,
      isNSFW: false,
      components: [
        {
          type: ComponentV2Type.TextDisplay,
          content: `**@${username}**`,
        },
        {
          type: ComponentV2Type.TextDisplay,
          content: `[View on Threads](${originalUrl})`,
        },
      ],
    };
  }
}