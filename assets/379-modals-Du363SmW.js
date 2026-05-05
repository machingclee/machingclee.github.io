const n=`---
title: "Custom Modal Simplification"
date: 2025-03-30
id: blog0379
tag: react
toc: true
intro: "Creation of modal is always a tedious task. We can create modal easily by ant-design's Modal component. But improper implementation can lead to plenty of highly non-reusable modals as the common mistake is to create that modal at the component we use it, making it tightly coupled with the state at which the modal is defined."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Usage Example

\`\`\`tsx{3-5}
...
<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
    <CustomModalTrigger modalContent={AddUserModal}>
        <Button type="primary">Add Staff</Button>
    </CustomModalTrigger>
</div>
...
\`\`\`

And the resulting modal:

![](/assets/img/2025-03-31-00-14-36.png)

### The Concret \`AddUserModal\` Example

We will be defining \`CustomModalProps\` in the next section, for reference we copy that definition here:

\`\`\`tsx
type CustomModalProps = {
  setOnOk: (action: Action) => void;
  setOkText: (text: string) => void;
};
\`\`\`

\`\`\`tsx-1{38,39}
export default function AddUserModal(props: CustomModalProps) {
    const { setOnOk: setOnOk, setOkText } = props;
    const dispatch = useAppDispatch();
    const formData = useRef<Partial<CreateUserRequest>>({
        role_in_system: 'STAFF',
    });
    const [error, setError] = useState<Partial<CreateUserRequest>>({});
    const update = (update_: Partial<CreateUserRequest>) => {
        formData.current = { ...formData.current, ...update_ };
    };
    const handleChange = (value: string) => {
        update({ role_in_system: value as RoleInSystem });
    };

    const roleSelections: { value: RoleInSystem; label: string }[] = [
        { value: 'STAFF', label: 'Staff' },
        { value: 'ADMIN', label: 'Admin' },
        { value: 'SUPER_ADMIN', label: 'Super Admin' },
    ];

    const submit = async () => {
        const res = await apiClient.post<CustomResponse<undefined>>(apiRoutes.POST_CREATE_USER, formData.current);
        if (!res.data.success) {
            const errorMessage = res.data?.errorMessage;
            const errorObject = res.data?.errorObject;
            if (errorMessage) {
                toastUtil.error(errorMessage);
            }
            if (errorObject) {
                setError(errorObject);
            }
        } else {
            toastUtil.success('User Created');
            AddUserDialog.setOpen(false);
            dispatch(UserThunkAction.getUsers());
        }
    };
    setOnOk(submit);
    setOkText('Submit');
\`\`\`

Note that we set the \`ok-action\` and \`ok-text\` here. Which under the hood update the value created by \`useRef\` in the modal created by our custom trigger. We **_would not_** do \`useState\` because that will definitely cause recurrsive rendering loop.

\`\`\`tsx-40
    return (
        <Box
            style={{
                maxWidth: 400,
                width: 600,
                padding: '40px 80px',
                overflowY: 'auto',
                paddingBottom: 60,
            }}
        >
            <SectionTitle>Add Staff</SectionTitle>
            <Spacer />
            <FormInputField
                title="English First Name"
                onChange={t => update({ first_name: t })}
                error={error?.['first_name']}
            />
            <FormInputField
                title="English Last Name"
                onChange={t => update({ last_name: t })}
                error={error?.['last_name']}
            />
            <FormInputField
                title="Chinese First Name"
                onChange={t => update({ chinese_first_name: t })}
                error={error?.['chinese_first_name']}
            />
            <FormInputField
                title="Chinese Last Name"
                onChange={t => update({ chinese_last_name: t })}
                error={error?.['chinese_last_name']}
            />
            <FormInputField
                title="Company Email"
                onChange={t => update({ company_email: t })}
                error={error?.['company_email']}
            />
            <FormInputField title="Password" onChange={t => update({ password: t })} error={error?.['password']} />
            <FormInputField
                title="Phone Number"
                onChange={t => update({ mobile_number: t })}
                error={error?.['mobile_number']}
            />
            <FormInputField
                title="Role In Company"
                onChange={t => update({ role_in_company: t })}
                error={error?.['role_in_company']}
            />
            <FormInputTitle>Role in System</FormInputTitle>
            <Spacer height={5} />
            <Select
                dropdownStyle={{ zIndex: 10 ** 4 }}
                defaultValue="STAFF"
                style={{ width: 130 }}
                onChange={handleChange}
                options={roleSelections}
            />
            <Spacer />
            <Spacer />
        </Box>
    );
}
\`\`\`

### Modal with more Custom Props

As in the \`AddUserModal\` we slightly change the siguature:

\`\`\`tsx
export default function AddUserModal(props: CustsomModalProps & { someValue: string }) {
\`\`\`

now we inject our props by

\`\`\`tsx
<CustsomModalTrigger
  modalContent={(props) => <AddUserModal {...props} someValue="Hello" />}
>
  <Button type="primary">Add Staff</Button>
</CustsomModalTrigger>
\`\`\`

This is very helpful if our modal needs to be dynamic to some state of the current page.

### Code Implementation of CustomModalTrigger

\`\`\`tsx
import { Button, Modal } from "antd";
import { BaseButtonProps } from "antd/es/button/button";
import { ReactNode, useRef, useState } from "react";

export type CustsomModalProps = {
  setOnOk: (action: Action) => void;
  setOkText: (text: string) => void;
};

type Action = () => void | Promise<void>;

const CustomModalTrigger = (props: {
  style?: CSSProperties;
  modalClassName?: string;
  okButtonType?: BaseButtonProps["type"];
  modalContent: (props: CustomModalProps) => ReactNode;
  children: ReactNode;
}) => {
  const { okButtonType = "primary", style } = props;
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const modalRef = useRef<{
    okText: string;
    onOk: Action;
  }>({
    okText: "Ok",
    onOk: () => {},
  });

  const setOkText = (text: string) => {
    modalRef.current.okText = text;
  };
  const setOnOk = (action: Action) => {
    modalRef.current.onOk = action;
  };

  return (
    <>
      <div
        style={{ display: "inline-block", ...style }}
        onClick={() => setOpen(true)}
      >
        {props.children}
      </div>
      <Modal
        destroyOnClose={true}
        styles={{
          content: {
            maxHeight: "80vh",
            maxWidth: "60vw",
            overflowY: "scroll",
          },
        }}
        open={open}
        className={props.modalClassName}
        centered
        closable={false}
        onCancel={() => {
          setOpen(false);
        }}
        onClose={() => {
          setOpen(false);
        }}
        okText={modalRef.current.okText}
        footer={[
          <Button key="back" onClick={() => setOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type={okButtonType}
            loading={loading}
            onClick={async () => {
              try {
                setLoading(true);
                await modalRef.current.onOk();
                console.log("closing it");
                setOpen(false);
              } finally {
                setLoading(false);
              }
            }}
          >
            {modalRef.current.okText}
          </Button>,
        ]}
      >
        {props.modalContent({
          setOkText,
          setOnOk,
        })}
      </Modal>
    </>
  );
};

export default CustsomModalTrigger;
\`\`\`
`;export{n as default};
