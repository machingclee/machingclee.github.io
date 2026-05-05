const n=`---
title: "Snackbar Utils"
date: 2023-08-10
id: blog0162
tag: react
intro: "Record a configuraton for snackbar utils."
toc: false
---

<center></center>

\`\`\`ts
// snackbarUtils.ts

import { ProviderContext, VariantType, useSnackbar } from "notistack";

let useSnackbarRef: ProviderContext;

export const SnackbarUtilsConfigurator = () => {
  useSnackbarRef = useSnackbar();
  return null;
};

const option: Parameters<typeof useSnackbarRef.enqueueSnackbar>[1] = {
  preventDuplicate: true,
  autoHideDuration: 10000,
};

export default {
  success(msg: string) {
    useSnackbarRef.enqueueSnackbar(msg, { variant: "success", ...option });
  },
  warning(msg: string) {
    useSnackbarRef.enqueueSnackbar(msg, { variant: "warning", ...option });
  },
  info(msg: string) {
    useSnackbarRef.enqueueSnackbar(msg, { variant: "info", ...option });
  },
  error(msg: string) {
    useSnackbarRef.enqueueSnackbar(msg, { variant: "error", ...option });
  },
  toast(msg: string, variant: VariantType = "default") {
    useSnackbarRef.enqueueSnackbar(msg, { variant, ...option });
  },
};
\`\`\`

Next in our file wrapping the \`<App/>\` element, we add:

\`\`\`ts
import { SnackbarProvider } from 'notistack';

    ...
    <SnackbarProvider
        maxSnack={2}
        anchorOrigin={{
            horizontal: 'left',
            vertical: "bottom"
        }}
    >
        <SnackbarUtilsConfigurator />
        ...
        <App />
    </SnackbarProvider>
\`\`\`
`;export{n as default};
