const { Jimp, intToRGBA, rgbaToInt } = require('jimp');

async function processAquila() {
  const image = await Jimp.read('public/crt-aquila.png');
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  // Find the bounding box of the non-dark pixels to see where the outline is
  // Or just erase the outline by keeping only the center brightest pixels
  // Let's just find the brightest color
  let maxG = 0;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const hex = image.getPixelColor(x, y);
      const rgba = intToRGBA(hex);
      if (rgba.g > maxG) maxG = rgba.g;
    }
  }
  
  // Now only keep pixels that are significantly bright, turning the rest completely transparent
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const hex = image.getPixelColor(x, y);
      const rgba = intToRGBA(hex);
      
      // If it's a faint outline, it's likely much darker than the max brightness
      if (rgba.r < 50 && rgba.g < 50 && rgba.b < 50) {
         image.setPixelColor(0x00000000, x, y); // wipe out dark pixels (the box background)
      } else if (x < 15 || x > width - 15 || y < 15 || y > height - 15) {
         // Wipe out the border area (15px from edge) where the box outline probably is
         image.setPixelColor(0x00000000, x, y);
      }
    }
  }
  
  await image.write('public/crt-aquila.png');
  console.log('Cleaned crt-aquila.png');
}

processAquila().catch(console.error);
