const { Jimp, intToRGBA, rgbaToInt } = require('jimp');

async function removeBackground() {
  const image = await Jimp.read('C:\\Users\\kyleb\\.gemini\\antigravity\\brain\\c3b328e8-54c0-4f41-915a-9fc5b72f9a6e\\purity_seal_magenta_1779290362237.png');
  
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const hex = image.getPixelColor(x, y);
      const rgba = intToRGBA(hex);
      
      // Magenta is roughly R:255, G:0, B:255
      if (rgba.r > 180 && rgba.g < 100 && rgba.b > 180) {
        image.setPixelColor(0x00000000, x, y); // Transparent
      } else if (rgba.r > 150 && rgba.g < 120 && rgba.b > 150) {
        image.setPixelColor(rgbaToInt(rgba.r, rgba.g, rgba.b, 128), x, y); // Semi-transparent for edges
      }
    }
  }
  
  await image.write('public/purity-seal.png');
  console.log('Background removed successfully!');
}

removeBackground().catch(console.error);
