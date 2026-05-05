const n=`---
title: "Radio Buttons Group and General Dropdown List"
date: 2023-06-21
id: blog0144
tag: react
intro: "Record the implementation of radio button group and dropdown list, in a hope that we don't need to waste time cooking it up again in the future."
toc: true
---

### Radio Buttons

\`\`\`typescript
import * as React from "react";
import Radio from "@mui/material/Radio";
import { makeStyles } from "@material-ui/core";
import classnames from "classnames";

const useStyles = makeStyles({
  selectionList: {
    "& span": {
      marginRight: 2,
    },
    "& .selection-row": {
      display: "flex",
      alignItems: "center",
    },
  },
});

export default function RadioButtonsGroup<T extends string>({
  value,
  setValue,
  listOfValues: options = [],
  style = {},
  className = "",
}: {
  value: ReturnType<typeof React.useState<T>>[0];
  setValue: ReturnType<typeof React.useState<T>>[1];
  listOfValues?: { value: T; displayName: string }[];
  style?: React.CSSProperties;
  className?: string;
}) {
  const classes = useStyles();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value as unknown as T);
  };

  const controlProps = (item: string) => ({
    checked: value === item,
    onChange: handleChange,
    value: item,
    name: "color-radio-button-demo",
    inputProps: { "aria-label": item },
  });

  return (
    <div className={classnames(classes.selectionList, className)} style={style}>
      {options.map((opt) => {
        const { displayName, value } = opt;
        return (
          <div className="selection-row">
            <Radio {...controlProps(value)} size="small" /> {displayName}
          </div>
        );
      })}
    </div>
  );
}
\`\`\`

Usage:

\`\`\`typescript
<RadioButtonsGroup
  className={classes.radio}
  style={{ display: "flex" }}
  value={value}
  setValue={setValue}
  listOfValues={[
    {
      value: "Important",
      displayName: "Important",
    },
    {
      value: "Submittal",
      displayName: "Submittal",
    },
    {
      value: "Confirmation",
      displayName: "Confirmation",
    },
  ]}
/>
\`\`\`

Which results result similar to

<Center>
    <img src="/assets/tech/145/001.png"/>
</Center>
<p/>
<center></center>

Here the display styles are refined by using \`style\` and \`className\` attributes, where

\`\`\`ts
const useStyles = makeStyles({
  radio: {
    "& .selection-row": {
      marginRight: 20,
    },
  },
});
\`\`\`

### Custom Dropdown List

We will name it \`GeneralDropdown\`:

\`\`\`typescript
import { CSSProperties, useEffect, useRef, useState } from "react";
import { Popper, makeStyles } from "@material-ui/core";
import classnames from "classnames";
import { BsFillCaretUpFill } from "react-icons/bs";
import normalizeUtil from "../util/normalizeUtil";
import useClickOutside from "../pages/hooks/useClickOutside";
import { useMainStyles } from "../pages/CorrespondenceDashboard/CorrespondenceDashboard";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";

const borderStyle = "1px solid rgb(200, 200, 200)";
const borderRadius = 4;
const options = {
  scrollbars: { autoHide: "scroll" },
};

const useStyles = makeStyles({
  display: {
    overflow: "hidden",
    zIndex: 3,
    textOverflow: "ellipsis",
  },
  disabled: {
    pointerEvents: "none",
    opacity: 0.4,
  },

  option: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    padding: "8px 8px",
    fontFamily: "Roboto, Helvetica, Arial, sans-serif",
    "&:hover": {
      backgroundColor: "#f2f9fc",
    },
    "&.selected": {
      backgroundColor: "rgb(0, 166, 250)",
      color: "white",
    },
  },
});

const UpIcon = () => {
  return (
    <BsFillCaretUpFill
      style={{ opacity: 0.2, transform: "scaleX(0.8) scaleY(0.7)" }}
    />
  );
};
const DownIcon = () => {
  return (
    <BsFillCaretUpFill
      style={{ opacity: 0.2, transform: "scaleX(0.8) scaleY(-0.7)" }}
    />
  );
};

type Option = { code: string; name: string; className?: string };

const GeneralDropdown = <T extends { code: string; name: string }>({
  initialValue,
  fullList,
  refUpdateHandler = () => {},
  selectionHint = "Select",
  className = "",
  enableNone = false,
  optionStyle = {},
  disablePredicate = (option: T) => false,
  style = {},
}: {
  initialValue: T | null;
  fullList: T[];
  refUpdateHandler?: (selection: T | null) => void;
  selectionHint?: string;
  className?: string;
  style?: CSSProperties;
  optionStyle?: CSSProperties;
  disablePredicate?: (option: T) => boolean;
  enableNone?: boolean;
}) => {
  const mainClasses = useMainStyles();
  const classes = useStyles();
  const selectionDisplayRef = useRef<HTMLDivElement>(null);
  const dropDownRef = useRef<HTMLDivElement>(null);
  const [eleWidth, setEleWidth] = useState(0);
  const [selectedName, setSelectedName] = useState(initialValue?.name || "");
  const [selectedCode, setSelectedCode] = useState(initialValue?.code || "");

  const { outsideClicked: outsideOfDropdownClicked } = useClickOutside({
    ref: dropDownRef,
  });

  const [showDropdown, setShowDropdown] = useState(false);

  const { idToObject: codeToObject } = normalizeUtil({
    targetArr: fullList,
    idAttribute: "code",
  });

  const additionalNoneOption: Option[] = enableNone
    ? [
        {
          name: "None",
          code: "",
          className: enableNone ? "" : classes.disabled,
        },
      ]
    : [];

  const options_: Option[] = additionalNoneOption.concat(
    fullList.map((opt) => ({
      name: opt.name,
      code: opt.code,
      className: classnames(
        disablePredicate(opt) ? classes.disabled : "",
        selectedCode === opt.code ? "selected" : ""
      ),
    }))
  );
  const refUpdateHandler_ = (arg: Option) => {
    const orgingalData = codeToObject?.[arg.code];
    refUpdateHandler(orgingalData);
  };

  useEffect(() => {
    if (selectionDisplayRef.current) {
      const width = selectionDisplayRef.current.offsetWidth;
      setEleWidth(width);
    }
  }, []);

  useEffect(() => {
    if (outsideOfDropdownClicked) {
      setShowDropdown(false);
    }
  }, [outsideOfDropdownClicked]);

  const hasOption = options_.length > 0;

  return (
    <div style={{ width: "100%", ...style }}>
      <div
        style={{
          position: "relative",
          pointerEvents: showDropdown ? "none" : "auto",
        }}
        onClick={() => setShowDropdown(true)}
        className={className}
      >
        <div
          ref={selectionDisplayRef}
          style={{
            border: borderStyle,
            padding: "6px 10px",
            borderRadius: borderRadius,
            userSelect: "none",
            borderBottomLeftRadius: showDropdown ? 0 : borderRadius,
            borderBottomRightRadius: showDropdown ? 0 : borderRadius,
          }}
        >
          <div
            style={{ width: "calc(100% - 20px)" }}
            className={classes.display}
          >
            {selectedName ? selectedName : selectionHint}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            top: "50%",
            transform: "translateY(calc(-50% + 3px))",
            right: 4,
          }}
        >
          {!showDropdown && <DownIcon />}
          {showDropdown && <UpIcon />}
        </div>
      </div>
      <Popper
        className={mainClasses.mainPage}
        style={{
          fontWeight: 400,
          background: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(80px) brightness(115%)",
          marginTop: -1,
          width: Math.max(eleWidth, 0),
          whiteSpace: "nowrap",
          border: borderStyle,
          zIndex: 10000,
        }}
        open={showDropdown}
        anchorEl={selectionDisplayRef.current}
        transition
      >
        <div
          style={{
            width: selectionDisplayRef.current?.offsetWidth,
          }}
          ref={dropDownRef}
        >
          <OverlayScrollbarsComponent
            style={{
              maxHeight: 300,
              overflow: "hidden",
            }}
          >
            {!hasOption && (
              <div
                style={{ padding: 10, userSelect: "none" }}
                className={classnames(classes.option, classes.disabled)}
              >
                No options
              </div>
            )}

            {hasOption &&
              options_.map((item) => {
                return (
                  <div
                    title={item.name}
                    key={item.code}
                    style={{
                      width: "calc(100% - 2px)",
                      cursor: "pointer",
                      ...optionStyle,
                    }}
                    onClick={() => {
                      setShowDropdown(false);
                      refUpdateHandler_(item);
                      setSelectedName(item.name);
                      setSelectedCode(item.code);
                    }}
                    className={classnames(classes.option, item.className || "")}
                  >
                    {item.name}
                  </div>
                );
              })}
          </OverlayScrollbarsComponent>
        </div>
      </Popper>
    </div>
  );
};

export default GeneralDropdown;
\`\`\`

- Under the hood \`GeneralDropdown\` just requires \`code\` as an identifier and \`name\` as a display of selected items.
- We can do complicated selection update logic in \`refUpdateHandler\` (not the \`name\` and \`code\`, we update \`id\` here).
`;export{n as default};
