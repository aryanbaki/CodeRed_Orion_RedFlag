import {readFile,writeFile} from 'node:fs/promises';
const files=[['Merriweather-Regular.ttf','400','normal'],['Merriweather-Bold.ttf','700','normal'],['Merriweather-Black.ttf','900','normal'],['Merriweather-Italic.ttf','400','italic']];
const faces=await Promise.all(files.map(async([file,weight,style])=>({weight,style,base64:(await readFile('src/extension/fonts/'+file)).toString('base64')})));
await writeFile('src/ui/font-data.ts',`// Generated from the user-supplied Merriweather fonts. License: src/extension/fonts/OFL.txt.\n// Local bytes also support injected UI without host-page font requests.\nexport const merriweatherFaces = ${JSON.stringify(faces)};\n`);
