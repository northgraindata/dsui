import { Component, type ReactNode } from "react";

export class PluginErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (
      <span role="alert">Plugin content unavailable</span>
    ) : (
      this.props.children
    );
  }
}
