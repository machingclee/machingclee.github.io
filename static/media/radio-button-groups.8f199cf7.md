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
import * as React from 'react';
import Radio from '@mui/material/Radio';
import { makeStyles } from '@material-ui/core';

const useStyles = makeStyles({
    selectionList: {
        "& span": {
            marginRight: 2,
        },
        "& .selection-row": {
            display: "flex",
            alignItems: "center"
        }
    }
})

type UseStateType = ReturnType<typeof React.useState<string>>;
export default function WBAddCompanyFormRadioButtons({ value, setValue, listOfValues: options = [] }: {
    value: UseStateType[0],
    setValue: UseStateType[1],
    listOfValues?: { value: string, displayName: string }[]
}) {
    const classes = useStyles();
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value);
    };
    const controlProps = (item: string) => ({
        checked: value === item,
        onChange: handleChange,
        value: item,
        name: 'color-radio-button-demo',
        inputProps: { 'aria-label': item },
    });

    return (
        <div className={classes.selectionList}>
            {options.map(opt => {
                const { displayName, value } = opt;
                return <div className="selection-row"><Radio {...controlProps(value)} size='small' /> {displayName}</div>;
            })}
        </div>
    );
}
```
Now we apply it by:
```typescript
const [formOption, setFormOption] = React.useState<string | undefined>("B");
return (
    <WBAddCompanyFormRadioButtons
        value={formOption}
        setValue={setFormOption}
        listOfValues={[
            { value: "B", displayName: "Buyer" },
            { value: "S", displayName: "Supplier" },
            { value: "FF", displayName: "Freight Forwarder" }
        ]}
    />
)
```
Which results in 
<Center>
    <img src="/assets/tech/145/001.png"/>
</Center>


#### Custom Generic Dropdown List

We will name it `GeneralDropdown`:

```typescript
import { useEffect, useState } from "react";
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";

// code acts as an id
export type DropdownItem = {
    code: string,
    name: string
}

const GeneralDropdown = <T extends DropdownItem>({
    initialValue,
    fullList,
    refUpdateHandler = () => { },
    selectionHint = "Select"
}: {
    initialValue: T | null,
    fullList: T[],
    refUpdateHandler?: (selection: T | null) => void,
    selectionHint?: string
}) => {
    const [selectionName, setSelectionName] = useState<string>("");
    useEffect(() => {
        setSelectionName(initialValue?.name || "");
    }, []);

    const handleCompDisplayStateChange = (event: SelectChangeEvent) => {
        setSelectionName(event.target.value as string);
    };
    // for fake data compatability, originally if availableCompanies (buyer companies from API) does not contain the fake data, then the initial value cannot be shown.
    const addFakeValueToList = (): (T | null)[] => {
        const selectedValue = fullList.find(c => c.code == initialValue?.code);
        if (!selectedValue) {
            // i.e., the current value is fake data, it does not exists in fullList from API
            return [initialValue, ...fullList]
        }
        else {
            return fullList;
        }
    }

    return (
        <>
            <FormControl sx={{ m: 1, minWidth: 200 }} size="small">
                <InputLabel id="demo-select-small-label">{selectionHint}</InputLabel>
                <Select
                    labelId="select-small-label"
                    id="select-small"
                    label="Select"
                    value={selectionName}
                    onChange={handleCompDisplayStateChange}
                >
                    <MenuItem value={""} onClick={() => { refUpdateHandler(null) }}>
                        <em>None</em>
                    </MenuItem>

                    {addFakeValueToList().map((selection) => {
                        return (
                            <MenuItem key={selection?.name} onClick={() => {
                                refUpdateHandler(selection);
                            }} value={selection?.name}>{selection?.name}</MenuItem>
                        )
                    })}
                </Select>
            </FormControl>
        </>
    );
}

export default GeneralDropdown;
```


Use cases:

- ```typescript
  const updateRefChangeHandler = (update: Partial<DetailedCategory>) => {
      updateDataRef.current = { ...updateDataRef.current, ...update };
  }
  const freightCalcGpList = Object.values(FreightCalcGroup).map(v => ({
      code: v,
      name: v
  }));
  return (
      ...
      <GeneralDropdown
          fullList={freightCalcGpList}
          initialValue={{ code: cat.freightCalcGroup, name: cat.freightCalcGroup }}
          refUpdateHandler={(gp) => { 
              updateRefChangeHandler({ freightCalcGroup: gp?.code }) }
          }
      />
  )
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