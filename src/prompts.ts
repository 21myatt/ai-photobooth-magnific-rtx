const SOURCE_SAFETY = `Preserve exactly the same number of visible humans as @img1. Do not add, remove, duplicate, merge, replace, or invent any person. If the source image has one person, the final image must have one person. If the source image has two people, the final image must have two people. If the source image has five people, the final image must have five people. Keep each visible person's identity, facial structure, expression, age appearance, body proportions, and relative position faithful to the source image. Do not convert any person into a different character; keep them as themselves in the selected style.`;

const NEGATIVE_SAFETY = `No extra people, no background crowd, no duplicate faces, no distorted hands, no readable text, no logos.`;

export const PROMPT_PRESETS = [
  {
    id: "gold-desert",
    name: "Gold Desert Luxury",
    prompt: `for @img1, create a cinematic luxury gold desert photobooth portrait using the captured photo as the only source reference.

${SOURCE_SAFETY}

Transform only the environment, wardrobe, lighting, and editorial styling. Dress all visible people in elegant high-fashion outfits in white, beige, champagne, and metallic gold accents. Place them in a refined golden desert scene with soft rippled dunes, warm sunset light, amber and rose sky tones, subtle gold dust particles, minimal golden lantern decor, and cinematic soft natural lighting. High-end editorial photography, polished photobooth portrait, realistic skin texture, natural faces, premium event-photo finish. ${NEGATIVE_SAFETY}`,
  },
  {
    id: "fisheye-grocery-glam",
    name: "Fisheye Grocery Glam",
    prompt: `for @img1, create an extreme fisheye grocery-store glamour portrait using the captured photo as the only source reference.

${SOURCE_SAFETY}

Transform only the environment, wardrobe, lighting, and editorial styling. Place all visible people in a brightly lit convenience store or supermarket aisle with a dramatic ultra-wide fisheye perspective, exaggerated foreground objects, shiny product reflections, and saturated neon-orange styling. Use energetic fashion-editorial framing, glossy flash photography, deep contrast, crisp details, and a chaotic but controlled magazine-cover finish. ${NEGATIVE_SAFETY}`,
  },
  {
    id: "packaged-product-surreal",
    name: "Packaged Product Surreal",
    prompt: `for @img1, create a packaged-product surreal portrait using the captured photo as the only source reference.

${SOURCE_SAFETY}

Transform only the environment, wardrobe, lighting, and editorial styling. Place all visible people inside a pink foam or meat-tray style package under clear plastic wrap, with a stark studio-black background, harsh clean product lighting, glossy reflections, and blank retail-label shaped graphic blocks with no readable text. Keep faces realistic and centered, with a strange but polished commercial-art finish, ultra-detailed skin, sharp contrast, and no clutter. ${NEGATIVE_SAFETY}`,
  },
  {
    id: "lego-room-pop",
    name: "LEGO Room Pop",
    prompt: `for @img1, create a bright playful LEGO-inspired room portrait using the captured photo as the only source reference.

${SOURCE_SAFETY}

Transform only the environment, wardrobe, lighting, and editorial styling. Reimagine the scene as a colorful room built from LEGO-like bricks, with blocky furniture, toy-like props, saturated primary colors, and a playful handcrafted feel. Dress all visible people in LEGO-inspired premium editorial fashion while keeping their real human identity and body proportions intact. Use soft studio lighting, crisp texture detail, vivid colors, and a whimsical magazine-poster composition. ${NEGATIVE_SAFETY}`,
  },
  {
    id: "collectible-figure-studio",
    name: "Collectible Figure Studio",
    prompt: `for @img1, create a minimalist collectible figure studio portrait using the captured photo as the only source reference.

Preserve exactly the same number of visible humans as @img1. Do not add, remove, duplicate, merge, replace, or invent any person. Keep each visible person's facial identity, facial structure, expression, age appearance, and relative position faithful to the source image. Allow only a tasteful stylized collectible-figure body treatment; do not change faces into different characters.

Transform only the environment, wardrobe, lighting, and editorial styling. Recast all visible people as tiny premium collectible figures with realistic recognizable heads, simplified miniature bodies, clean pastel studio background, soft shadows, and a premium toy-photography look. Use bright clean lighting, precise cutout edges, and a polished social-media-cover finish. ${NEGATIVE_SAFETY}`,
  },
  {
    id: "monster-pop-editorial",
    name: "Monster Pop Editorial",
    prompt: `for @img1, create a chaotic monster-pop editorial portrait using the captured photo as the only source reference.

${SOURCE_SAFETY}

Transform only the environment, wardrobe, lighting, and editorial styling. Put all visible people in a surreal elevator or display-box scene surrounded by oversized colorful non-human toy monsters, plush creatures, and absurd pop-art shapes. The creatures must be clearly non-human props, not extra people and not human-like faces. Make the composition dense, loud, and highly stylized, with glossy toy surfaces, candy colors, and a hyper-saturated fashion-campaign look. Keep all visible people grounded and recognizable amid the chaos. ${NEGATIVE_SAFETY}`,
  },
  {
    id: "comic-music-poster",
    name: "Comic Music Poster",
    prompt: `for @img1, create a comic-book music poster portrait using the captured photo as the only source reference.

${SOURCE_SAFETY}

Transform only the environment, wardrobe, lighting, and editorial styling. Place all visible people in front of a black-and-white comic panel background with energetic line art, blank speech-bubble shapes, and sound-effect inspired graphic bursts with no readable text. Use realistic central subject treatment against hand-drawn illustration panels, sharp pop-art contrast, clean studio lighting, and a playful poster-like finish. ${NEGATIVE_SAFETY}`,
  },
  {
    id: "inflatable-letter-set",
    name: "Inflatable Letter Set",
    prompt: `for @img1, create a giant inflatable-shape fashion portrait using the captured photo as the only source reference.

${SOURCE_SAFETY}

Transform only the environment, wardrobe, lighting, and editorial styling. Surround all visible people with oversized glossy yellow inflatable abstract letter-like shapes that do not form readable words, filling a narrow interior or corridor with an overwhelming sculptural installation. Make it feel like a bold fashion stunt photo, with reflective vinyl surfaces, controlled composition, crisp flash lighting, and a striking viral-poster aesthetic. ${NEGATIVE_SAFETY}`,
  },
  {
    id: "rainy-superhero-cinema",
    name: "Rainy Superhero Cinema",
    prompt: `for @img1, create a rainy cinematic superhero-inspired portrait using the captured photo as the only source reference.

${SOURCE_SAFETY}

Transform only the environment, wardrobe, lighting, and editorial styling. Reimagine all visible people in a dark rainy city scene with wet hair, dramatic backlight, blue and purple tones, glowing bokeh, and cinematic storm effects. Use realistic superhero-inspired fashion or tactical styling while keeping every face natural and recognizable, not as an existing branded character. Make it feel like a moody movie poster with sharp focus on faces, rain streaks, wet reflections, and intense atmosphere. ${NEGATIVE_SAFETY}`,
  },
  {
    id: "vintage-birthday-vhs",
    name: "Vintage Birthday VHS",
    prompt: `for @img1, create a candid vintage birthday home-video portrait using the captured photo as the only source reference.

${SOURCE_SAFETY}

Transform only the environment, wardrobe, lighting, and editorial styling. Reimagine the scene as a VHS-style backyard birthday gathering with casual family energy, soft analog blur, faded colors, authentic camcorder snapshot feel, and subtle timestamp-like camera artifacts without readable numbers or letters. Keep all visible people recognizable and natural, with imperfect framing, nostalgic video grain, and a lived-in amateur-recording look. ${NEGATIVE_SAFETY}`,
  },
] as const;

export const DEFAULT_PROMPT_PRESET = PROMPT_PRESETS[0];
