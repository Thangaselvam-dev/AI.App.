// ═══════════════════════════════════════════════
//  services/aiPoster.js
//  Stable Diffusion — DMK Poster Generator
//
//  This service builds a prompt that describes
//  a DMK-style poster and sends it to Stability AI.
//  It returns a URL to the generated image.
// ═══════════════════════════════════════════════

const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

// ─── Build a DMK-specific image prompt ──────────
// Stability AI needs a very descriptive text prompt.
// The better the prompt, the better the poster.
function buildPosterPrompt({ slogan, event, template }) {

  // Base DMK visual identity
  const base = `
    Professional political poster,
    deep crimson red and pure black color scheme,
    DMK party aesthetic,
    Tamil Nadu government official style,
    bold Tamil typography,
    high contrast design,
    Instagram post format,
    ultra high quality, 4K resolution
  `.replace(/\s+/g, " ").trim();

  // Template-specific additions
  const templateStyles = {
    rally: `
      energetic rally poster,
      crowd silhouette in background,
      sun rising motif (DMK symbol),
      dramatic lighting,
      bold headline typography
    `,
    achievement: `
      government achievement announcement poster,
      clean modern layout,
      infographic elements,
      progress icons,
      professional corporate style
    `,
    scheme: `
      welfare scheme announcement,
      happy Tamil families imagery,
      warm community feeling,
      golden accent lines,
      approachable friendly design
    `,
    birthday: `
      political birthday celebration poster,
      floral garland border,
      gold and red festive elements,
      portrait photo frame placeholder,
      respectful dignified tone
    `,
    quote: `
      minimalist quote poster,
      dark moody background,
      elegant serif Tamil font,
      single spotlight effect,
      powerful and dramatic
    `,
  };

  const sloganLine = slogan
    ? `Text overlay: "${slogan}"`
    : "";

  const eventLine = event
    ? `Occasion: ${event}`
    : "";

  const style = templateStyles[template] || templateStyles.achievement;

  return `${base}, ${style.replace(/\s+/g, " ").trim()}, ${sloganLine}, ${eventLine}`;
}

// ─── Generate DMK Poster via Stability AI ────────
async function generateDMKPoster({ slogan, event, template, leader_photo, width, height }) {

  const prompt = buildPosterPrompt({ slogan, event, template });

  // Negative prompt — things we DON'T want in the image
  const negativePrompt = `
    blurry, low quality, watermark, text errors,
    wrong colors, multiple people, nude, violence,
    opposite party symbols, poor typography
  `.replace(/\s+/g, " ").trim();

  try {
    const response = await axios.post(
      "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
      {
        text_prompts: [
          { text: prompt,         weight: 1.0 },
          { text: negativePrompt, weight: -1.0 }, // Negative prompt
        ],
        cfg_scale:    7,     // How closely to follow the prompt (1-35)
        height:       1024,  // SD XL works best at 1024×1024
        width:        1024,
        samples:      1,     // Number of images to generate
        steps:        30,    // More steps = higher quality but slower
        style_preset: "digital-art",
      },
      {
        headers: {
          Authorization:  `Bearer ${process.env.STABILITY_API_KEY}`,
          "Content-Type": "application/json",
          Accept:         "application/json",
        },
        timeout: 60000, // 60 second timeout (image gen is slow)
      }
    );

    // Stability returns base64-encoded image
    const base64Image = response.data.artifacts[0].base64;

    // In production: upload to AWS S3 and return URL
    // For now: return as base64 data URL
    const imageUrl = `data:image/png;base64,${base64Image}`;

    return {
      success:   true,
      image_url: imageUrl,
      prompt_used: prompt,
    };

  } catch (err) {
    // If Stability AI fails, return a placeholder
    console.error("Stability AI error:", err.response?.data || err.message);

    // Return a DMK-colored placeholder image URL
    // (You can replace this with a real fallback later)
    return {
      success:     false,
      image_url:   `https://placehold.co/${width}x${height}/C41E3A/white?text=${encodeURIComponent(slogan || "DMK")}`,
      error:       "AI poster generation failed, using placeholder",
    };
  }
}

module.exports = { generateDMKPoster };
