const e=`---
title: "Generate Excel by Openpyxl"
date: 2023-10-20
id: blog0199
tag: python, openpyxl, excel
intro: "We implement a reusable utility class that handle most of the jobs in creating excel programmatically."
toc: true
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

### Convention

- All column and row indexes are designed to **_start with 1_**.
- If we see \`cell_pos: Tuple[int, int]\`, that means \`(col_index, row_index)\`.

### An ExcelCellUtil Class

#### config.py File in the Same Directory

\`\`\`python
IMG_SEPARATION = 40
COLS_ALPHABET = "-ABCDEFGHIJKLMNOPQRSTUVWXYZ"
\`\`\`

#### Imports

\`\`\`python
from openpyxl import Workbook
from openpyxl.worksheet.worksheet import Worksheet
from PIL import Image
from openpyxl.drawing.image import Image as XLImage
from src import config
import requests
from openpyxl.utils.units import pixels_to_EMU
from openpyxl.drawing.xdr import XDRPositiveSize2D
from openpyxl.drawing.spreadsheet_drawing import AnchorMarker, OneCellAnchor
from openpyxl.styles import PatternFill, Alignment, Font
from typing import TypedDict, Tuple, List, Optional, cast, Union, Literal
from uuid import uuid4
from src.wb_scripts.llm_excel_report.dto import Issue, ReportGenerationDetail, Summary
from src.wb_scripts.llm_excel_report.config import COLS_ALPHABET, IMG_SEPARATION
from datetime import datetime, tzinfo
import os
import math


class ExcelCellUtil:
\`\`\`

#### Set Fonts

\`\`\`python
    def set_default_font(self, ws: Worksheet, default_font=font_calibri):
        for row in ws.iter_rows():
            for cell in row:
                cell.font = font_calibri
\`\`\`

#### Auto-Height a row to fit Cell Contents

\`\`\`python
    def set_fit_text(self, ws, from_row: int, to_row: int):
        row_range = range(from_row, to_row)

        for i, row in enumerate(ws.iter_rows()):
            if i not in row_range:
                continue
            ws.row_dimensions[i].height = None
\`\`\`

#### Set a offset of an Image Relative to the Upper-left Corner of a Cell

\`\`\`python
    def offset_img(self, xl_img: XLImage, cell_pos: Tuple[int, int], x_offset: int = 10, y_offset: int = 10):
        """
        both col and row starts from 1
        """
        col = cell_pos[0]
        row = cell_pos[1]
        p2e = pixels_to_EMU
        h, w = xl_img.height, xl_img.width
        size = XDRPositiveSize2D(p2e(w), p2e(h))
        marker = AnchorMarker(
            col=col-1,
            row=row-1,
            colOff=pixels_to_EMU(x_offset),
            rowOff=pixels_to_EMU(y_offset)
        )
        xl_img.anchor = OneCellAnchor(_from=marker, ext=size)
\`\`\`

- This approch is **_not I/O efficient_**, but this python script is going to be deployed on **_Lambda Service_**, efficiency is less of importance to getting the job done.

#### Fill Cell Color

\`\`\`python
    def fill_cell_color(self, ws: Worksheet, cell_pos: Tuple[int, int], color: str):
        ws.cell(column=cell_pos[0], row=cell_pos[1]).fill = PatternFill(
            "solid",
            start_color=color
        )
\`\`\`

#### Merge Cell

\`\`\`python
    def merge_cell(self, ws, start: Tuple[int, int], end: Tuple[int, int]):
        start_x = start[0]
        start_y = start[1]
        end_x = end[0]
        end_y = end[1]
        ws.merge_cells(start_row=start_y,
                       start_column=start_x,
                       end_row=end_y,
                       end_column=end_x)
\`\`\`

#### Insert Text into a Cell

\`\`\`python
    XAlignment = Literal["center","centerContinuous","general","distributed","left","right","fill","justify"]
    YAlignment = Literal["bottom", "center", "top", "distributed", "justify"]

    def insert_text(self, ws: Worksheet, pos: Tuple[int, int], text: str, horizontal: XAlignment="left", vertical: YAlignment="top" ):
        col = pos[0]
        row = pos[1]
        ws.cell(column=col, row=row).alignment = Alignment(wrap_text=True, horizontal=horizontal,vertical=vertical)
        ws.cell(column=col, row=row).value = text
\`\`\`

#### Resize an Image

\`\`\`python
    def resize_image(self, img: Image.Image, new_width: int):
        new_height = img.height * new_width/img.width
        return img.resize((int(new_width), int(new_height)))
\`\`\`

- Note that we use \`PIL.Image.Image\`, we will need to save this image to disk and load from \`openpyxl\`.
- This approach is not unnecessary, because we need a **_true resize_** (\`pillow\` to reduce file size) and a **_faked resize_** (\`openpyxl\` for high resolution) when user zooms in.

#### Calculate the max Height among a set of Images

\`\`\`python
    def max_height_from_imgs(self, imgs: List[Image.Image]):
        return max(map(lambda x: x.height, imgs))
\`\`\`

This is to get ready for inserting images into a single cell.

#### Control the Width and Height of a Cell

\`\`\`python
    def set_cell_width_height(self, ws: Worksheet, cell_pos: Tuple[int, int], width: Optional[float] = None, height: Optional[float] = None):
        col = cell_pos[0]
        row = cell_pos[1]
        if width is not None:
            ws.column_dimensions[COLS_ALPHABET[col]].width = width / 7
        if height is not None:
            ws.row_dimensions[row].height = height * 3 / 4
\`\`\`

#### Insert Multiple Images into a Cell

\`\`\`python
    def insert_imgs(self,
                    ws: Worksheet,
                    cell_pos: Tuple[int, int],
                    image_width: int = 1,
                    img_separation: int = IMG_SEPARATION,
                    top_y_offset: int = 20,
                    imgs: List[Image.Image] = []):
        new_imgs = []
        for img in imgs:
            img = self.resize_image(img, new_width=image_width)
            new_imgs.append(img)

        imgs = new_imgs

        xl_imgs = []
        img_tmp_paths = []

        for img in imgs:
            img_tmp_path = "/tmp/excels/" + str(uuid4()) + ".png"
            img_tmp_paths.append(img_tmp_path)
            img.save(img_tmp_path)
            xl_img = XLImage(img_tmp_path)
            new_width = 100
            new_height = xl_img.height * (100/xl_img.width)
            xl_img.width = new_width
            xl_img.height = new_height
            xl_imgs.append(xl_img)

        max_imgs_per_row = config.MAX_IMGS_PER_ROW
        n_rows = math.floor(len(imgs)/max_imgs_per_row) + 1

        max_img_height = self.max_height_from_imgs(xl_imgs)

        self.set_cell_width_height(
            ws,
            cell_pos,
            config.MAX_IMGS_PER_ROW * (100 + img_separation) + img_separation,
            (max_img_height + img_separation) * n_rows
        )

        for index, xl_img in enumerate(xl_imgs):
            row_index = math.floor(index / max_imgs_per_row)
            self.offset_img(xl_img,
                            cell_pos,
                            x_offset=img_separation + (index % config.MAX_IMGS_PER_ROW) * (100 + img_separation),
                            y_offset=top_y_offset + (max_img_height + img_separation) * row_index)

            if not os.path.exists("/tmp/excels/"):
                os.makedirs("/tmp/excels/")

            ws.add_image(xl_img)

        return img_tmp_paths
\`\`\`

We also provide the temporary file paths in order to delete them after the file generation is completed.

#### Insert Single Image

\`\`\`python
    def insert_img(self,
                   ws: Worksheet,
                   cell_pos: Tuple[int, int],
                   image_width: int,
                   offsets: Tuple[int, int],
                   img: Image):
        img = self.resize_image(img, image_width)

        if not os.path.exists("/tmp/excels"):
            os.makedirs("/tmp/excels")

        img_tmp_path = "/tmp/excels/" + str(uuid4()) + ".png"
        img.save(img_tmp_path)
        xl_img = XLImage(img_tmp_path)

        self.offset_img(
            xl_img, cell_pos, x_offset=offsets[0], y_offset=offsets[1]
        )
        if not os.path.exists("/tmp/excels/"):
            os.makedirs("/tmp/excels/")

        ws.add_image(xl_img)

        return img_tmp_path
\`\`\`

#### Align text to center

\`\`\`python
    def align_center(self, ws, cell_pos: Tuple[int, int]):
        ws.cell(column=cell_pos[0], row=cell_pos[1]).alignment = Alignment(
            horizontal="center", vertical="center")
\`\`\`

#### Remarks

\`set_default_font\` and \`set_fit_text\` (auto-height) should be executed right before saving the workbook. New data insertation may make the font-assertion and auto-height fail.

### Reason why we need PIL.Image instead of openpyxl.drawing.image.Image

#### Strategy to Handle Images in Our ExcelCellUtil

Why we need both? Because normal users (especially to those who have machine learning background using \`pytorch\`) are more familiar with APIs in \`Pillow\`. We can manipulate images, save that image to disk, and load the image by the api of \`XLImage\`.

#### Load Image from Internet by PIL.Image

\`openpyxl\` does not provide api to load images from \`file_uri\` over the internet (i.e., it is designed to load local disk file only). To overcome this limitation, we use \`PIL.Image\` (the result will be of type \`PIL.Image.Image\`):

\`\`\`python
img: PIL.Image.Image = PIL.Image.open(requests.get(img_url, stream=True).raw)
\`\`\`

This is why we design the signature to use \`PIL.Image\` instead of \`openpyxl\`'s one:

\`\`\`python
ExcelCellUtil.insert_imgs(ws: Worksheet,
                          cell_pos: Tuple[int, int],
                          image_width: int = 1,
                          img_separation: int = IMG_SEPARATION,
                          top_y_offset: int = 20,
                          imgs: List[Image.Image] = [])
\`\`\`

### Usage

\`\`\`python
wb = Workbook()
ws = cast(Worksheet, wb.active)

util = ExcelCellUtil()
tmp_img_paths = []

util.merge_cell(ws, (1, 1), (2, 7))
util.insert_text(ws, (3, 1), "Session Name")
...
wb.save("some_where.xlsx")
\`\`\`
`;export{e as default};
