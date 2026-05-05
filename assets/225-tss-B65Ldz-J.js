const n=`---
title: "TSS as a Replacement of makeStyles"
date: 2023-12-10
id: blog0225
tag: react
intro: "In recent mui \`makeStyles\` is no longer maintained, but css in tss is still a very good idea so we record an alternative in this article."
toc: true
---

### Installation

\`\`\`text
yarn add tss-react
\`\`\`

### Styles

#### Style that Intake a State

\`\`\`js
const useButtonStyles = tss
    .withParams<{ disabled: boolean }>()
    .create(({ disabled }) => ({
        disabled: {
            opacity: disabled ? 0.5 : 1,
            pointerEvents: disabled ? "none" : "auto"
        }
    }));
\`\`\`

#### Style Without a State

\`\`\`js
const useStyles = tss.create(() => ({
  example: {
    paddingLeft: "calc(2em - 3px)",
    borderLeft: "3px solid rgba(123,185,209,0.3)",
  },
  proof: {
    "& > p:nth-child(1)": {
      textIndent: "calc(3px - 2em) !important",
    },
    paddingLeft: "calc(2em - 3px)",
    marginTop: 20,
    marginBottom: 20,
  },
  codeBlock: {
    "& .react-syntax-highlighter-line-number": {
      minWidth: "2.5em !important",
    },
    "& pre": {
      paddingTop: "0.95em !important",
      background: "#F5F5F5!important",
      // paddingLeft: "0.55em !important",
      border: "1px solid #E0E0E0",
      borderRadius: 2,
    },

    "& .no-bg": {
      background: "transparent !important",
      "& code": {
        background: "transparent !important",
      },
    },
  },
}));
\`\`\`

### Usage

\`\`\`js
const SomeDiv = (props: SomeProps) => {
  const { classes, cx } = useStyles();
  ...

  return <div className={cx(classes.codeBlock)}>...</div>;
};
\`\`\`
`;export{n as default};
