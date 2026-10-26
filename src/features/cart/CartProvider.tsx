import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Cart } from "../../types";
import {
  EMPTY_CART,
  addLine as addLineToCart,
  clearCart as clearCartLines,
  loadCart,
  removeLine as removeLineFromCart,
  saveCart,
  setQuantity as setCartQuantity,
} from "../../lib/cart";

interface CartContextValue {
  cart: Cart;
  addLine: (line: { menuItemId: string; name: string; unitPrice: number; quantity?: number }) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  removeLine: (menuItemId: string) => void;
  setNote: (note: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(() => loadCart());

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const addLine = useCallback(
    (line: { menuItemId: string; name: string; unitPrice: number; quantity?: number }) => {
      setCart((current) =>
        addLineToCart(current, {
          menuItemId: line.menuItemId,
          name: line.name,
          unitPrice: line.unitPrice,
          quantity: line.quantity ?? 1,
        }),
      );
    },
    [],
  );

  const setQuantity = useCallback((menuItemId: string, quantity: number) => {
    setCart((current) => setCartQuantity(current, menuItemId, quantity));
  }, []);

  const removeLine = useCallback((menuItemId: string) => {
    setCart((current) => removeLineFromCart(current, menuItemId));
  }, []);

  const setNote = useCallback((note: string) => {
    setCart((current) => ({ ...current, note: note.slice(0, 300) }));
  }, []);

  const clear = useCallback(() => setCart(clearCartLines()), []);

  const value = useMemo<CartContextValue>(() => {
    const count = cart.lines.reduce((sum, l) => sum + l.quantity, 0);
    const subtotal = cart.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    return { cart, addLine, setQuantity, removeLine, setNote, clear, count, subtotal };
  }, [cart, addLine, setQuantity, removeLine, setNote, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export { EMPTY_CART };
