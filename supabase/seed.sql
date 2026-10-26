-- ---------------------------------------------------------------------------
-- Seed data: one canteen, four categories, a realistic menu.
-- Run with: supabase db seed  (or paste into the SQL editor)
-- Sample data lives ONLY here - never in application logic.
-- ---------------------------------------------------------------------------

insert into canteens (id, name, location_label, is_open, allow_customer_cancellation,
                      estimated_wait_message, pickup_instructions)
values (
  '11111111-1111-4111-8111-111111111111',
  'Main Campus Canteen',
  'Ground floor, Block A',
  true,
  true,
  'About 10 minutes',
  'Collect your order at the main counter and show your pickup token.'
);

insert into menu_categories (id, canteen_id, name, sort_order) values
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'Snacks', 1),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Meals', 2),
  ('22222222-2222-4222-8222-222222222223', '11111111-1111-4111-8111-111111111111', 'Beverages', 3),
  ('22222222-2222-4222-8222-222222222224', '11111111-1111-4111-8111-111111111111', 'Combos', 4);

insert into menu_items (id, canteen_id, category_id, name, description, price, is_available, sort_order) values
  -- Snacks
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'Samosa (2 pc)', 'Crispy pastry filled with spiced potato and peas.', 20.00, true, 1),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'Veg Sandwich', 'Grilled sandwich with cucumber, tomato and mint chutney.', 35.00, true, 2),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'French Fries', 'Golden salted fries with masala dip.', 50.00, true, 3),
  ('33333333-3333-4333-8333-333333333304', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'Pani Puri', 'Six puris with sweet and tangy water.', 30.00, false, 4),
  -- Meals
  ('33333333-3333-4333-8333-333333333311', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Veg Thali', 'Dal, seasonal sabzi, rice, 3 chapatis, salad and pickle.', 80.00, true, 1),
  ('33333333-3333-4333-8333-333333333312', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Fried Rice', 'Wok-tossed rice with vegetables and spring onion.', 70.00, true, 2),
  ('33333333-3333-4333-8333-333333333313', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Chole Bhature', 'Two bhature with spicy chickpea curry and onion.', 75.00, true, 3),
  ('33333333-3333-4333-8333-333333333314', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Curd Rice', 'Tempered rice with curd, curry leaf and pomegranate.', 60.00, true, 4),
  -- Beverages
  ('33333333-3333-4333-8333-333333333321', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222223', 'Masala Chai', 'Freshly brewed tea with ginger and cardamom.', 15.00, true, 1),
  ('33333333-3333-4333-8333-333333333322', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222223', 'Filter Coffee', 'Strong south Indian filter coffee with froth.', 20.00, true, 2),
  ('33333333-3333-4333-8333-333333333323', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222223', 'Fresh Lime Soda', 'Sweet, salted or mixed.', 25.00, true, 3),
  ('33333333-3333-4333-8333-333333333324', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222223', 'Cold Coffee', 'Blended iced coffee with a light foam.', 45.00, true, 4),
  -- Combos
  ('33333333-3333-4333-8333-333333333331', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222224', 'Student Combo', 'Veg sandwich + masala chai.', 45.00, true, 1),
  ('33333333-3333-4333-8333-333333333332', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222224', 'Full Meal Combo', 'Veg thali + fresh lime soda.', 95.00, true, 2),
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222224', 'Snack + Coffee', 'Samosa + filter coffee.', 30.00, true, 3);
