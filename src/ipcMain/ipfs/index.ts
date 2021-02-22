import { ipcMain } from "electron";
import fs from "fs";
import all from "it-all";
import uint8ArrayConcat from "uint8arrays/concat";

import { node } from "../..";

ipcMain.handle("upload-file", async (_, files) => {
  try {
    const filesWithContent = await Promise.all(
      files.map(async (file: any) => {
        const fileContent = fs.readFileSync(file.path);
        const content = Buffer.from(fileContent);
        const res = await node.add({
          path: file.name,
          content,
        });

        return { hash: String(res.cid), name: file.name };
      })
    );

    return filesWithContent;
  } catch (error) {
    return error;
  }
});

ipcMain.handle("download-file", async (_, hash) => {
  try {
    // eslint-disable-next-line
    for await (const file of node.get(hash)) {
      // eslint-disable-next-line
      if (!file.content) continue;

      const content = [];

      // eslint-disable-next-line
      for await (const chunk of file.content) {
        content.push(chunk);
      }

      return {
        success: true,
        file: content,
      };
    }

    return {
      success: false,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
});

ipcMain.handle("get-image-preview", async (_, hash) => {
  try {
    const data = uint8ArrayConcat(await all(node.cat(hash)));

    return {
      success: true,
      file: data,
    };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      error: String(error),
    };
  }
});
