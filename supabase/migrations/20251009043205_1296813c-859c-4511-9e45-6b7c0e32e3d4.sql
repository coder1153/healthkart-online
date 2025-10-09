-- Add INSERT policy for order_items so users can create order items for their own orders
CREATE POLICY "Users can create order items for their own orders"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);