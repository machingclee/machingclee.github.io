const n=`---
title: Coco Dataset Format Used in CVAT (Raspect Only)
date: 2022-04-29
id: blog068
tag: raspect
wip: true
intro: Record the content of the coco dataset format needed in CVAT Tasks
---

### For Missing Signboards

Our \`json\` file will be of the form:

\`\`\`json
{
  "images": [
    {
      "id": 1,
      "image_source_path": "/home/raspect/nas1/tmp/joe/tmp/i8y6v_yn/P202203252_516_3098.jpg",
      "file_name": "2022_1st_trip02_reannotation/P202203252_516_3098.jpg",
      "width": 4176,
      "height": 2784,
      "classifications": []
    }
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "bbox": [1858, 1912, 683, 217],
      "segmentation": [],
      "iscrowd": 0,
      "category_id": 1,
      "classifications": [],
      "score": 0.857421875
    }
  ],
  "categories": [
    {
      "id": 1,
      "name": "signboard"
    }
  ]
}
\`\`\`

- \`image_source_path\` is not used by CVAT, it is the path we can copy from gp1 computer to na0.
- \`file_name\` is the field used by CVAT, it is the path of the images relative to the volume mount to the CVAT's docker image.
- This json will be run inside gp1 computer to do the copying process (using \`image_source_path\`).
- So this json file serve two purpose.

### For Missing Defects

#### Json Format

This time we will be using the 7 defect annotations used by the training team. They are:

- \`damaged_display\`
- \`seg_damaged_display\`
- \`rust\`
- \`derelict\`
- \`deformed_structure\`
- \`frame\`
- \`hangout_bar\`

\`\`\`json
{
  "images": [
    {
      "id": 1,
      "image_source_path": "/home/raspect/nas1/tmp/joe/tmp/7e2uen4a/P202204066_2088_12538.jpg",
      "file_name": "2022_1st_trip06_defect_annotation/P202204066_2088_12538.jpg",
      "width": 4176,
      "height": 2784,
      "classifications": []
    }
  ],
  "categories": [
    {
      "id": 1,
      "name": "damaged_display"
    },
    {
      "id": 2,
      "name": "seg_damaged_display"
    },
    {
      "id": 3,
      "name": "rust"
    },
    {
      "id": 4,
      "name": "derelict"
    },
    {
      "id": 5,
      "name": "deformed_structure"
    },
    {
      "id": 6,
      "name": "frame"
    },
    {
      "id": 7,
      "name": "hangout_bar"
    }
  ]
}
\`\`\`

This time we don't need to provide \`annotations\` attribute.

#### Finding the Hash Before Image Name

As you may notice in \`image_source_path\`

\`\`\`none
/home/raspect/nas1/tmp/joe/tmp/i8y6v_yn/P202203252_516_3098.jpg
\`\`\`

there is an hash \`i8y6v_yn\` which cannot be queried in the database, therefore we need to connect to

\`\`\`none
gp1:/home/raspect/Workspaces/tai/ai-master/release/python/
\`\`\`

change the config in \`gen_coco.py\` to target trip, and run:

\`\`\`python
pyenv activate torch && python gen_coco.py
\`\`\`

The resulting json will contain the full path of the original image (which starts with \`/home\`), and we get the hash.
`;export{n as default};
