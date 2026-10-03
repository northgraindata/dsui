// Prebuilt browser entry. DSUI supplies the one shared React instance.
export function createComponents(React) {
  return {
    "example-plugin/service-summary": function ServiceSummary({ node }) {
      const { name, adapter } = node.props.props;
      return React.createElement(
        "span",
        { className: "text-[11px] text-secondary" },
        `${name} · ${adapter}`,
      );
    },
  };
}
