---
title: "Radio Buttons Group and Generic Dropdown List"
date: 2023-06-21
id: blog0144
tag: react
intro: "Record the implementation of radio button group and dropdown list, in a hope that we don't need to waste time cooking it up again in the future."
toc: true
---

#### Radio Buttons

```typescript
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
```

Usage:

```typescript
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
```

Which results result similar to

<Center>
    <img src="/assets/tech/145/001.png"/>
</Center>
<p/>
<center></center>

Here the display styles are refined by using `style` and `className` attributes, where

```ts
const useStyles = makeStyles({
  radio: {
    "& .selection-row": {
      marginRight: 20,
    },
  },
});
```

#### Custom Dropdown List

We will name it `GeneralDropdown`:

```typescript
import { CSSProperties, useEffect, useRef, useState } from "react";
import { Popper, makeStyles } from "@material-ui/core";
import classnames from "classnames";
import { BsFillCaretUpFill } from "react-icons/bs";
import normalizeUtil from "../util/normalizeUtil";
import useClickOutside from "../pages/hooks/useClickOutside";
import { useMainStyles } from "../pages/MailChain/CorrespondenceDashboard";

const borderStyle = "1px solid rgb(200, 200, 200)";
const borderRadius = 4;

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
    "&:hover": {
      backgroundColor: "#f2f9fc",
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

  const { outsideClicked: outsideOfDropdownClicked } = useClickOutside({
    ref: dropDownRef,
  });

  const [showDropdown, setShowDropdown] = useState(false);

  const { idToObject: codeToObject } = normalizeUtil({
    targetArr: fullList,
    idAttribute: "code",
  });

  const additionalNoneOption: Option[] = [
    { name: "None", code: "", className: enableNone ? "" : classes.disabled },
  ];

  const options_: Option[] = additionalNoneOption.concat(
    fullList.map((opt) => ({
      name: opt.name,
      code: opt.code,
      className: disablePredicate(opt) ? classes.disabled : "",
    }))
  );
  const refUpdateHandler_ = (arg: Option) => {
    const orgingalData = codeToObject?.[arg.code];
    refUpdateHandler(orgingalData);
  };
  const [displayName, setDisplayName] = useState(initialValue?.name);

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
            {displayName ? displayName : selectionHint}
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
          background: "white",
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
            width: "100%",
            maxHeight: 300,
            overflow: "scroll",
          }}
          ref={dropDownRef}
        >
          {options_.map((item) => {
            return (
              <div
                title={item.name}
                key={item.code}
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  padding: "8px 8px",
                  cursor: "pointer",
                  fontFamily: "Roboto, Helvetica, Arial, sans-serif",
                  ...optionStyle,
                }}
                onClick={() => {
                  setShowDropdown(false);
                  refUpdateHandler_(item);
                  setDisplayName(item.name);
                }}
                className={classnames(classes.option, item.className || "")}
              >
                {item.name}
              </div>
            );
          })}
        </div>
      </Popper>
    </div>
  );
};

export default GeneralDropdown;
```

- Note that `GeneralDropdown` itself is a generic function which accepts any type that extends `{code: string, name: string}`:
  ```typescript
  type MeansurementUnit = {
      id: number,
      name: string,
      code: string,
      name_styled: string,
      enabled: boolean
  }
  const units: MeansurementUnit[] = useAppSelector(s => s.wbcategories.units);
  return (
      ...
      <GeneralDropdown
          fullList={units}
          initialValue={unit || { code: "", name: "", enabled: false, id: -1, name_styled: "" }}
          refUpdateHandler={(unit) => {
              if (unit) {
                  updateRefChangeHandler({ uom_rdbms_id: unit.id })
              }
          }}
      />
  )
  ```
  - Under the hood `GeneralDropdown` just requires `code` as an identifier and `name` as a display of selected items.
  - We can do complicated selection update logic in `refUpdateHandler` (not the `name` and `code`, we update `id` here).
