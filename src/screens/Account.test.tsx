import { act, fireEvent, render, screen } from "@testing-library/react";
import { AuthContext, COPY, DISABLED, type AuthResult, type AuthValue } from "../auth/auth";
import Account from "./Account";

function setup(over: Partial<AuthValue> = {}) {
  const value: AuthValue = {
    ...DISABLED,
    status: "signed_out",
    signIn: vi.fn(async (): Promise<AuthResult> => ({ ok: true, error: null })),
    signUp: vi.fn(async (): Promise<AuthResult> => ({ ok: true, error: null })),
    ...over,
  };
  const onClose = vi.fn();
  render(
    <AuthContext.Provider value={value}>
      <Account onClose={onClose} />
    </AuthContext.Provider>,
  );
  return { value, onClose };
}

const address = () => screen.getByLabelText("address") as HTMLInputElement;
const password = () => screen.getByLabelText("password") as HTMLInputElement;
const submit = (name = "sign in") => screen.getByRole("button", { name });

function fill(a: string, p: string) {
  fireEvent.change(address(), { target: { value: a } });
  fireEvent.change(password(), { target: { value: p } });
}

describe("Account", () => {
  it("fields have labels, types and autocomplete", () => {
    setup();
    expect(address()).toHaveAttribute("type", "email");
    expect(address().getAttribute("autocomplete")).toContain("email");
    expect(password()).toHaveAttribute("type", "password");
    expect(password()).toHaveAttribute("autocomplete", "current-password");
    fireEvent.click(screen.getByRole("button", { name: "show password" }));
    expect(password()).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("tab", { name: "create account" }));
    expect(password()).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByText(/your words sync to a server in Zurich \(Supabase\)/)).toBeInTheDocument();
  });

  it("validation blocks a bad address and a short password", async () => {
    const { value } = setup();
    for (const bad of ["ab.ch", "a@b", "@b.ch"]) {
      fill(bad, "12345678");
      await act(async () => fireEvent.click(submit()));
      expect(screen.getByRole("alert")).toBeInTheDocument();
    }
    fill("a@b.ch", "1234567");
    await act(async () => fireEvent.click(submit()));
    expect(screen.getByRole("alert")).toHaveTextContent(COPY.weak);
    expect(value.signIn).not.toHaveBeenCalled();
  });

  it("signIn gets the typed values and success closes", async () => {
    const { value, onClose } = setup();
    fill("a@b.ch", "12345678");
    await act(async () => fireEvent.click(submit()));
    expect(value.signIn).toHaveBeenCalledWith("a@b.ch", "12345678");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("blocks a duplicate submit while pending", async () => {
    let resolve!: (r: AuthResult) => void;
    const signIn = vi.fn(() => new Promise<AuthResult>((r) => (resolve = r)));
    setup({ signIn });
    fill("a@b.ch", "12345678");
    await act(async () => {
      fireEvent.click(submit());
      fireEvent.click(submit());
    });
    expect(submit()).toBeDisabled();
    fireEvent.submit(submit().closest("form")!);
    expect(signIn).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: false, error: COPY.invalid }));
    expect(submit()).not.toBeDisabled();
  });

  it("renders the mapped error copy", async () => {
    setup({ signIn: vi.fn(async () => ({ ok: false, error: COPY.invalid })) });
    fill("a@b.ch", "12345678");
    await act(async () => fireEvent.click(submit()));
    expect(screen.getByRole("alert")).toHaveTextContent("that address and password don't match");
  });

  it("existing address on create account switches to sign in, keeps the address", async () => {
    const signUp = vi.fn(async () => ({ ok: false, existing: true, error: COPY.existing }));
    setup({ signUp });
    fireEvent.click(screen.getByRole("tab", { name: "create account" }));
    fill("a@b.ch", "12345678");
    await act(async () => fireEvent.click(submit("create account")));
    expect(signUp).toHaveBeenCalledWith("a@b.ch", "12345678");
    expect(screen.getByRole("alert")).toHaveTextContent(COPY.existing);
    expect(screen.getByRole("tab", { name: "sign in" })).toHaveAttribute("aria-selected", "true");
    expect(submit()).toBeInTheDocument();
    expect(address().value).toBe("a@b.ch");
    expect(password().value).toBe("");
  });

  it("mode switch keeps the address and clears the password", () => {
    setup();
    fill("a@b.ch", "12345678");
    fireEvent.click(screen.getByRole("tab", { name: "create account" }));
    expect(address().value).toBe("a@b.ch");
    expect(password().value).toBe("");
  });

  it("needsConfirm shows the confirm message and back to sign in", async () => {
    setup({ signUp: vi.fn(async () => ({ ok: false, needsConfirm: true, error: COPY.confirm })) });
    fireEvent.click(screen.getByRole("tab", { name: "create account" }));
    fill("a@b.ch", "12345678");
    await act(async () => fireEvent.click(submit("create account")));
    expect(screen.getByText("check your inbox to confirm your address, then sign in here.")).toBeInTheDocument();
    expect(screen.queryByLabelText("password")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "back to sign in" }));
    expect(submit()).toBeInTheDocument();
    expect(address().value).toBe("a@b.ch");
  });

  it("'not now' closes", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "not now" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape closes", () => {
    const { onClose } = setup();
    fireEvent.keyDown(address(), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
