const x=`---
title: "Box Shadow"
date: 2023-08-27
id: blog0168
tag: react
intro: "Record a list of box-shadow in a json object."
toc: false
---

\`\`\`js
// boxShadow.ts

export default {
  SHADOW_01: "rgba(149, 157, 165, 0.2) 0px 8px 24px",
  SHADOW_02: "rgba(100, 100, 111, 0.2) 0px 7px 29px 0px",
  SHADOW_03: "rgba(0, 0, 0, 0.15) 1.95px 1.95px 2.6px",
  SHADOW_04: "rgba(0, 0, 0, 0.35) 0px 5px 15px",
  SHADOW_05: "rgba(0, 0, 0, 0.16) 0px 1px 4px",
  SHADOW_06: "rgba(0, 0, 0, 0.24) 0px 3px 8px",
  SHADOW_07: "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px",
  SHADOW_08:
    "rgba(0, 0, 0, 0.02) 0px 1px 3px 0px, rgba(27, 31, 35, 0.15) 0px 0px 0px 1px",
  SHADOW_09: "rgba(0, 0, 0, 0.1) 0px 4px 12px",
  SHADOW_10:
    "rgba(0, 0, 0, 0.25) 0px 54px 55px,rgba(0, 0, 0, 0.12) 0px -12px 30px,rgba(0, 0, 0, 0.12) 0px 4px 6px,rgba(0, 0, 0, 0.17) 0px 12px 13px,rgba(0, 0, 0, 0.09) 0px -3px 5px",
  SHADOW_11:
    "rgba(0, 0, 0, 0.05) 0px 6px 24px 0px,rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
  SHADOW_12:
    "rgba(0, 0, 0, 0.16) 0px 10px 36px 0px,rgba(0, 0, 0, 0.06) 0px 0px 0px 1px",
  SHADOW_13: "rgba(17, 12, 46, 0.15) 0px 48px 100px 0px",
  SHADOW_14:
    "rgba(255, 255, 255, 0.1) 0px 1px 1px 0px inset,rgba(50, 50, 93, 0.25) 0px 50px 100px -20px,rgba(0, 0, 0, 0.3) 0px 30px 60px -30px",
  SHADOW_15:
    "rgba(50, 50, 93, 0.25) 0px 50px 100px -20px,rgba(0, 0, 0, 0.3) 0px 30px 60px -30px",
  SHADOW_16:
    "rgba(50, 50, 93, 0.25) 0px 50px 100px -20px,rgba(0, 0, 0, 0.3) 0px 30px 60px -30px",
  SHADOW_17:
    "rgba(50, 50, 93, 0.25) 0px 13px 27px -5px,rgba(0, 0, 0, 0.3) 0px 8px 16px -8px",
  SHADOW_18:
    "rgba(50, 50, 93, 0.25) 0px 2px 5px -1px,rgba(0, 0, 0, 0.3) 0px 1px 3px -1px",
  SHADOW_19:
    "rgba(50, 50, 93, 0.25) 0px 6px 12px -2px,rgba(0, 0, 0, 0.3) 0px 3px 7px -3px",
  SHADOW_20:
    "rgba(50, 50, 93, 0.25) 0px 13px 27px -5px,rgba(0, 0, 0, 0.3) 0px 8px 16px -8px",
  SHADOW_21:
    "rgba(50, 50, 93, 0.25) 0px 30px 60px -12px,rgba(0, 0, 0, 0.3) 0px 18px 36px -18px",
  SHADOW_22:
    "rgba(50, 50, 93, 0.25) 0px 50px 100px -20px,rgba(0, 0, 0, 0.3) 0px 30px 60px -30px",
  SHADOW_23: "rgba(0, 0, 0, 0.12) 0px 1px 3px,rgba(0, 0, 0, 0.24) 0px 1px 2px",
  SHADOW_24: "rgba(0, 0, 0, 0.16) 0px 3px 6px, rgba(0, 0, 0, 0.23) 0px 3px 6px",
  SHADOW_25:
    "rgba(0, 0, 0, 0.25) 0px 14px 28px,rgba(0, 0, 0, 0.22) 0px 10px 10px",
  SHADOW_26:
    "rgba(0, 0, 0, 0.3) 0px 19px 38px,rgba(0, 0, 0, 0.22) 0px 15px 12px",
  SHADOW_27:
    "rgba(60, 64, 67, 0.3) 0px 1px 2px 0px,rgba(60, 64, 67, 0.15) 0px 2px 6px 2px",
  SHADOW_28:
    "rgba(60, 64, 67, 0.3) 0px 1px 2px 0px,rgba(60, 64, 67, 0.15) 0px 1px 3px 1px",
  SHADOW_29: "rgba(0, 0, 0, 0.05) 0px 0px 0px 1px",
  SHADOW_30: "rgba(0, 0, 0, 0.05) 0px 1px 2px 0px",
  SHADOW_31:
    "rgba(0, 0, 0, 0.1) 0px 1px 3px 0px,rgba(0, 0, 0, 0.06) 0px 1px 2px 0px",
  SHADOW_32:
    "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px,rgba(0, 0, 0, 0.06) 0px 2px 4px -1px",
  SHADOW_33:
    "rgba(0, 0, 0, 0.1) 0px 10px 15px -3px,rgba(0, 0, 0, 0.05) 0px 4px 6px -2px",
  SHADOW_34:
    "rgba(0, 0, 0, 0.1) 0px 20px 25px -5px,rgba(0, 0, 0, 0.04) 0px 10px 10px -5px",
  SHADOW_35: "rgba(0, 0, 0, 0.25) 0px 25px 50px -12px",
  SHADOW_36:
    "rgba(0, 0, 0, 0.1) 0px 0px 5px 0px,rgba(0, 0, 0, 0.1) 0px 0px 1px 0px",
  SHADOW_37:
    "rgba(0, 0, 0, 0.07) 0px 1px 2px,rgba(0, 0, 0, 0.07) 0px 2px 4px,rgba(0, 0, 0, 0.07) 0px 4px 8px,rgba(0, 0, 0, 0.07) 0px 8px 16px,rgba(0, 0, 0, 0.07) 0px 16px 32px,rgba(0, 0, 0, 0.07) 0px 32px 64px",
  SHADOW_38: "rgba(0, 0, 0, 0.2) 0px 18px 50px -10px",
  SHADOW_39: "rgba(0, 0, 0, 0.1) 0px 10px 50px",
  SHADOW_40: "rgba(0, 0, 0, 0.04) 0px 3px 5px",
  SHADOW_41:
    "rgba(67, 71, 85, 0.27) 0px 0px 0.25em,rgba(90, 125, 188, 0.05) 0px 0.25em 1em",
  SHADOW_42:
    "rgba(14, 30, 37, 0.12) 0px 2px 4px 0px,rgba(14, 30, 37, 0.32) 0px 2px 16px 0px",
  SHADOW_43:
    "rgba(0, 0, 0, 0.2) 0px 12px 28px 0px,rgba(0, 0, 0, 0.1) 0px 2px 4px 0px,rgba(255, 255, 255, 0.05) 0px 0px 0px 1px inset",
  SHADOW_44: "rgba(0, 0, 0, 0.15) 0px 5px 15px 0px",
  SHADOW_45:
    "rgba(136, 165, 191, 0.48) 6px 2px 16px 0px,rgba(255, 255, 255, 0.8) -6px -2px 16px 0px",
  SHADOW_46:
    "rgba(17, 17, 26, 0.05) 0px 1px 0px,rgba(17, 17, 26, 0.1) 0px 0px 8px",
  SHADOW_47: "rgba(17, 17, 26, 0.1) 0px 0px 16px",
  SHADOW_48:
    "rgba(17, 17, 26, 0.05) 0px 4px 16px,rgba(17, 17, 26, 0.05) 0px 8px 32px",
  SHADOW_49:
    "rgba(17, 17, 26, 0.1) 0px 4px 16px,rgba(17, 17, 26, 0.05) 0px 8px 32px",
  SHADOW_50:
    "rgba(17, 17, 26, 0.1) 0px 1px 0px, rgba(17, 17, 26, 0.1) 0px 8px 24px, rgba(17, 17, 26, 0.1) 0px 16px 48px",
  SHADOW_51:
    "rgba(17, 17, 26, 0.1) 0px 4px 16px,rgba(17, 17, 26, 0.1) 0px 8px 24px,rgba(17, 17, 26, 0.1) 0px 16px 56px",
  SHADOW_52:
    "rgba(17, 17, 26, 0.1) 0px 8px 24px,rgba(17, 17, 26, 0.1) 0px 16px 56px,rgba(17, 17, 26, 0.1) 0px 24px 80px",
  SHADOW_53:
    "rgba(0, 0, 0, 0.15) 0px 15px 25px,rgba(0, 0, 0, 0.05) 0px 5px 10px",
  SHADOW_54: "rgba(0, 0, 0, 0.08) 0px 4px 12px",
  SHADOW_55: "rgba(0, 0, 0, 0.15) 0px 2px 8px",
  SHADOW_56: "rgba(0, 0, 0, 0.1) -4px 9px 25px -6px",
  SHADOW_57: "rgba(0, 0, 0, 0.2) 0px 20px 30px",
  SHADOW_58:
    "rgba(0, 0, 0, 0.25) 0px 0.0625em 0.0625em,rgba(0, 0, 0, 0.25) 0px 0.125em 0.5em,rgba(255, 255, 255, 0.1) 0px 0px 0px 1px inset",
  SHADOW_59: "rgba(0, 0, 0, 0.09) 0px 3px 12px",
  SHADOW_60:
    "rgba(0, 0, 0, 0.05) 0px 0px 0px 1px,rgb(209, 213, 219) 0px 0px 0px 1px inset",
  SHADOW_61:
    "rgba(9, 30, 66, 0.25) 0px 1px 1px,rgba(9, 30, 66, 0.13) 0px 0px 1px 1px",
  SHADOW_62:
    "rgba(9, 30, 66, 0.25) 0px 4px 8px -2px,rgba(9, 30, 66, 0.08) 0px 0px 0px 1px",
};
\`\`\`
`;export{x as default};
