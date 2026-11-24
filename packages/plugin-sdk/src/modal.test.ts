import { describe, expect, test } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createModal, MODAL_STYLES } from "./modal";

const Modal = createModal(React);

const render = (props: Partial<Parameters<typeof Modal>[0]> = {}) =>
  renderToStaticMarkup(
    React.createElement(
      Modal,
      { title: "New rule", onClose: () => undefined, ...props },
      React.createElement("input", { name: "name" }),
    ),
  );

describe("createModal", () => {
  test("renders a labelled native dialog with the content in a scrolling body", () => {
    const html = render({ subtitle: "Routes a signal" });
    expect(html).toContain("<dialog");
    expect(html).toMatch(/aria-labelledby="([^"]+)"/);
    const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(html).toContain(`<h2 id="${id}">New rule</h2>`);
    expect(html).toContain("Routes a signal");
    expect(html).toContain(
      '<div class="dsui-modal-body"><input name="name"/></div>',
    );
    expect(html).toContain('aria-label="Close"');
  });

  test("shows a footer only when it is given", () => {
    // The stylesheet names the class, so look for the element itself.
    expect(render()).not.toContain("<footer");
    expect(render({ footer: "Save" })).toContain(
      '<footer class="dsui-modal-footer">Save</footer>',
    );
  });

  test("content and footer may be functions of close", () => {
    const html = renderToStaticMarkup(
      React.createElement(Modal, {
        title: "Edit",
        onClose: () => undefined,
        // JSX writes this as a child; createElement only types it as a prop.
        // biome-ignore lint/correctness/noChildrenProp: function children
        children: (close: () => void) =>
          React.createElement("p", null, typeof close),
        footer: (close: () => void) =>
          React.createElement("span", null, typeof close),
      }),
    );
    expect(html).toContain("<p>function</p>");
    expect(html).toContain("<span>function</span>");
  });

  test("the close button is disabled while the dialog is not dismissible", () => {
    expect(render({ dismissible: false })).toMatch(
      /<button[^>]*aria-label="Close"[^>]*disabled/,
    );
    expect(render()).not.toMatch(/<button[^>]*aria-label="Close"[^>]*disabled/);
  });

  test("the width follows the size", () => {
    expect(render()).toContain("--dsui-modal-width:600px");
    expect(render({ size: "small" })).toContain("--dsui-modal-width:440px");
    expect(render({ size: "large" })).toContain("--dsui-modal-width:820px");
  });

  test("ships the styles that center it despite a host reset", () => {
    expect(render()).toContain(
      ".dsui-modal{position:fixed;inset:0;margin:auto",
    );
    expect(MODAL_STYLES).toContain("prefers-reduced-motion");
    expect(MODAL_STYLES).toContain("backdrop-filter:blur");
  });
});
