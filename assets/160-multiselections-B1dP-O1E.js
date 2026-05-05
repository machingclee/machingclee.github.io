const n=`---
title: "Multi-Selections"
date: 2023-08-03
id: blog0160
tag: react
intro: "Record a multi selection component."
toc: true
---

### Effect

<Center>
<img src="/assets/tech/160/001.png">
</Center>

### Usage

\`\`\`ts
<ListUpdateSelector
  defaultSelectionStrings={[]}
  allSelectionStrings={["selection1", "selection2", "selection3"]}
  optionChangeHandler={(selectedValues) => {
    someRef.current = selectedValues;
  }}
/>
\`\`\`

### Code Implementation

\`\`\`ts
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { autocompleteClasses } from "@mui/material/Autocomplete";
import { styled } from "@mui/material/styles";
import useAutocomplete, {
  AutocompleteGetTagProps,
} from "@mui/material/useAutocomplete";
import { CSSProperties, useEffect, useRef } from "react";

const Root = styled("div")(
  ({ theme }) => \`
  color: \${
    theme.palette.mode === "dark" ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,.85)"
  };
  font-size: 14px;
\`
);

const Label = styled("label")\`
  padding: 0 0 4px;
  line-height: 1.5;
  display: block;
\`;

const InputWrapper = styled("div")(
  ({ theme }) => \`
  border-radius: 4px;
  flex-wrap: wrap;

  &:hover {
    border-color: \${theme.palette.mode === "dark" ? "#177ddc" : "#40a9ff"};
  }

  & div {
    display: flex;
    justify-content: space-between;
  }

  & input {
    background-color: \${theme.palette.mode === "dark" ? "#141414" : "#fff"};
    color: \${
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.65)"
        : "rgba(0,0,0,.85)"
    };
    height: 30px;
    box-sizing: border-box;
    padding: 4px 6px;
    width: 1px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 2px;
    min-width: 30px;
    flex-grow: 1;
    margin: 0;
    outline: 0;
    width: 100%;
    margin: 0px;
    margin-top: 4px;
  }
\`
);

interface TagProps extends ReturnType<AutocompleteGetTagProps> {
  label: string;
}

function Tag(props: TagProps) {
  const { label, onDelete, ...other } = props;
  return (
    <div {...other}>
      <span>{label}</span>
      <CloseIcon onClick={onDelete} />
    </div>
  );
}

const StyledTag = styled(Tag)<TagProps>(
  ({ theme }) => \`
  display: flex;
  align-items: center;
  height: 24px;
  margin: 2px 0px;
  line-height: 22px;
  background-color: \${
    theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#fafafa"
  };
  border: 1px solid \${theme.palette.mode === "dark" ? "#303030" : "#e8e8e8"};
  border-radius: 2px;
  box-sizing: content-box;
  padding: 0 4px 0 10px;
  outline: 0;
  overflow: hidden;

  &:focus {
    border-color: \${theme.palette.mode === "dark" ? "#177ddc" : "#40a9ff"};
    background-color: \${theme.palette.mode === "dark" ? "#003b57" : "#e6f7ff"};
  }

  & span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  & svg {
    font-size: 12px;
    cursor: pointer;
    padding: 4px;
  }
\`
);

const Listbox = styled("ul")(
  ({ theme }) => \`
  width: 300px;
  margin: 2px 0 0;
  padding: 0;
  position: absolute;
  top: calc(100% + 5px);
  list-style: none;
  background-color: \${theme.palette.mode === "dark" ? "#141414" : "#fff"};
  overflow: auto;
  max-height: 250px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 3;


  & li {
    padding: 5px 12px;
    display: flex;

    & span {
      flex-grow: 1;
    }

    & svg {
      color: transparent;
    }
  }

  & li[aria-selected='true'] {
    background-color: \${theme.palette.mode === "dark" ? "#2b2b2b" : "#fafafa"};
    font-weight: 600;

    & svg {
      color: #1890ff;
    }
  }

  & li.\${autocompleteClasses.focused} {
    background-color: \${theme.palette.mode === "dark" ? "#003b57" : "#e6f7ff"};
    cursor: pointer;

    & svg {
      color: currentColor;
    }
  }
\`
);

export default function ListUpdateSelector({
  defaultSelectionStrings,
  allSelectionStrings,
  optionChangeHandler,
  style = {},
  inputStyle = {},
}: {
  defaultSelectionStrings: string[];
  allSelectionStrings: string[];
  optionChangeHandler: (option: string[]) => void;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
}) {
  const selections = allSelectionStrings;

  const {
    getRootProps,
    getInputLabelProps,
    getInputProps,
    getTagProps,
    getListboxProps,
    getOptionProps,
    groupedOptions,
    value,
    focused,
    setAnchorEl,
  } = useAutocomplete({
    id: "selector-hook",
    defaultValue: defaultSelectionStrings,
    multiple: true,
    options: selections,
    getOptionLabel: (option) => option,
  });

  const optionChangeHandlerTakesEffect = useRef(false);

  useEffect(() => {
    // prevent handler is called on the first render.
    if (optionChangeHandlerTakesEffect.current) {
      optionChangeHandler(value);
    } else {
      optionChangeHandlerTakesEffect.current = true;
    }
  }, [value]);

  return (
    <Root>
      <div
        className="user-row-selector"
        style={{ position: "relative", ...style }}
      >
        <div {...getRootProps()}>
          <InputWrapper ref={setAnchorEl} className={focused ? "focused" : ""}>
            {value.map((option: string, index: number) => (
              <span title={option}>
                <StyledTag label={option} {...getTagProps({ index })} />
              </span>
            ))}
            <input {...getInputProps()} style={inputStyle} />
          </InputWrapper>
        </div>
        {groupedOptions.length > 0 ? (
          <Listbox {...getListboxProps()}>
            {(groupedOptions as string[]).map((option, index) => (
              <li {...getOptionProps({ option, index })}>
                <span>{option}</span>
                <CheckIcon fontSize="small" />
              </li>
            ))}
          </Listbox>
        ) : null}
      </div>
    </Root>
  );
}
\`\`\`
`;export{n as default};
