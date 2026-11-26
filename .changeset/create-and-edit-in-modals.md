---
"@northgraindata/dsui-adapter-sdk": minor
---

A button or a row action can declare a `dialog`: a modal with its own page content, such as a `Form`. Row values fill `{field}` placeholders in its title and fields whose value is `{ field }`. In a dialog, submit stays disabled until something changes, closing with unsaved input asks first, success closes the dialog, and a failure keeps it open. A click outside closes it only with `closeOnOutsideClick`.

Every form now keeps submit disabled while nothing differs from its initial values.

Breaking: the Airflow adapter no longer has the `/connections/new`, `/connections/:connectionId/edit`, `/variables/new`, `/variables/:key/edit`, `/pools/new` and `/pools/:name/edit` pages.
