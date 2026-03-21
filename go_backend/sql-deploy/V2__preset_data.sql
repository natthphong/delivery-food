-- V2__preset_data.sql
-- Deterministic preset data required for local development and demos.

BEGIN;

INSERT INTO system_configs (config_key, config_value, description)
VALUES
  ('MAX_CART_ITEMS', '100', 'Maximum number of unique cart lines per user'),
  ('MAX_QTY_PER_ITEM', '10', 'Maximum quantity per cart or order line'),
  ('SINGLE_BRANCH_CHECKOUT', '1', 'Require a checkout payload to target one branch only'),
  ('QR_PAYMENT_TTL_SECONDS', '900', 'Pending QR transactions expire after 15 minutes')
ON CONFLICT (config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    description = EXCLUDED.description;

INSERT INTO payment_methods (id, code, name, method_type, is_active, details)
VALUES
  (1, 'QR_SLIP', 'PromptPay QR Slip', 'qr', TRUE, '{}'::JSONB),
  (2, 'WALLET', 'Wallet Balance', 'balance', TRUE, '{}'::JSONB)
ON CONFLICT (id) DO UPDATE
SET code = EXCLUDED.code,
    name = EXCLUDED.name,
    method_type = EXCLUDED.method_type,
    is_active = EXCLUDED.is_active,
    details = EXCLUDED.details;

SELECT setval(pg_get_serial_sequence('payment_methods', 'id'), GREATEST((SELECT MAX(id) FROM payment_methods), 1), TRUE);

INSERT INTO companies (id, slug, name, description, logo_url, currency_code, promptpay_id)
VALUES
  (
    1,
    'baan-foodie',
    'BaanFoodie',
    'Modern Thai comfort food built for mobile-first ordering.',
    'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=80',
    'THB',
    '0896324562'
  )
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    logo_url = EXCLUDED.logo_url,
    currency_code = EXCLUDED.currency_code,
    promptpay_id = EXCLUDED.promptpay_id;

SELECT setval(pg_get_serial_sequence('companies', 'id'), GREATEST((SELECT MAX(id) FROM companies), 1), TRUE);

INSERT INTO company_payment_methods (company_id, payment_method_id, sort_order, is_enabled)
VALUES
  (1, 1, 1, TRUE),
  (1, 2, 2, TRUE)
ON CONFLICT (company_id, payment_method_id) DO UPDATE
SET sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled;

INSERT INTO categories (id, company_id, slug, name, description, sort_order, is_active)
VALUES
  (1, 1, 'signatures', 'Signatures', 'Best-selling mains and signature bowls.', 1, TRUE),
  (2, 1, 'wok-favorites', 'Wok Favorites', 'Thai wok-fried comfort staples.', 2, TRUE),
  (3, 1, 'noodles', 'Noodles', 'Soup and dry noodle bowls.', 3, TRUE),
  (4, 1, 'drinks-dessert', 'Drinks & Dessert', 'Refreshers and sweet add-ons.', 4, TRUE)
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

SELECT setval(pg_get_serial_sequence('categories', 'id'), GREATEST((SELECT MAX(id) FROM categories), 1), TRUE);

INSERT INTO products (id, company_id, slug, name, description, image_url, base_price, search_terms, is_active)
VALUES
  (
    1, 1, 'baan-kaprao', 'Baan Kaprao',
    'Hot-and-dry holy basil over jasmine rice with a crisp fried egg.',
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
    89.00,
    'kaprao, basil, rice, signature, ข้าวกะเพรา',
    TRUE
  ),
  (
    2, 1, 'crispy-pork-kale', 'Crispy Pork Kale',
    'Crispy pork belly tossed with wok-charred kale and garlic.',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
    95.00,
    'pork belly, kale, wok, ข้าวคะน้าหมูกรอบ',
    TRUE
  ),
  (
    3, 1, 'boat-noodle-bowl', 'Boat Noodle Bowl',
    'Rich boat noodle broth with braised beef, herbs, and crunchy garlic.',
    'https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=900&q=80',
    99.00,
    'boat noodle, broth, beef, ก๋วยเตี๋ยวเรือ',
    TRUE
  ),
  (
    4, 1, 'thai-milk-tea', 'Thai Milk Tea',
    'Creamy Thai tea over ice.',
    'https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?auto=format&fit=crop&w=900&q=80',
    45.00,
    'tea, thai tea, drink, ชานมไทย',
    TRUE
  ),
  (
    5, 1, 'garlic-fried-chicken', 'Garlic Fried Chicken',
    'Crunchy garlic fried chicken with sweet chili dip.',
    'https://images.unsplash.com/photo-1562967916-eb82221dfb92?auto=format&fit=crop&w=900&q=80',
    85.00,
    'fried chicken, garlic, side, ไก่ทอดกระเทียม',
    TRUE
  ),
  (
    6, 1, 'mango-sticky-rice', 'Mango Sticky Rice',
    'Fresh mango with coconut sticky rice.',
    'https://images.unsplash.com/photo-1526318896980-cf78c088247c?auto=format&fit=crop&w=900&q=80',
    69.00,
    'dessert, mango, sticky rice, ข้าวเหนียวมะม่วง',
    TRUE
  ),
  (
    7, 1, 'tom-yum-udon', 'Tom Yum Udon',
    'Spicy creamy tom yum broth with udon noodles and shrimp.',
    'https://images.unsplash.com/photo-1617622141573-cb0b7f0cb26a?auto=format&fit=crop&w=900&q=80',
    109.00,
    'udon, tom yum, noodle, spicy, ต้มยำอูด้ง',
    TRUE
  ),
  (
    8, 1, 'basil-fried-rice', 'Basil Fried Rice',
    'Wok-fried rice packed with basil aroma and smoky heat.',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
    82.00,
    'fried rice, basil, rice, ข้าวผัดกะเพรา',
    TRUE
  )
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    base_price = EXCLUDED.base_price,
    search_terms = EXCLUDED.search_terms,
    is_active = EXCLUDED.is_active;

SELECT setval(pg_get_serial_sequence('products', 'id'), GREATEST((SELECT MAX(id) FROM products), 1), TRUE);

INSERT INTO product_categories (product_id, category_id)
VALUES
  (1, 1),
  (2, 2),
  (3, 3),
  (4, 4),
  (5, 2),
  (6, 4),
  (7, 3),
  (8, 1)
ON CONFLICT (product_id, category_id) DO NOTHING;

INSERT INTO product_add_ons (id, product_id, group_name, name, price, is_required, sort_order)
VALUES
  (1, 1, 'protein', 'Minced Chicken', 0.00, FALSE, 1),
  (2, 1, 'protein', 'Crispy Pork', 18.00, FALSE, 2),
  (3, 1, 'extras', 'Extra Fried Egg', 12.00, FALSE, 1),
  (4, 3, 'toppings', 'Braised Beef', 20.00, FALSE, 1),
  (5, 3, 'toppings', 'Extra Noodles', 15.00, FALSE, 2),
  (6, 7, 'protein', 'Extra Shrimp', 28.00, FALSE, 1),
  (7, 8, 'extras', 'Fried Egg', 12.00, FALSE, 1)
ON CONFLICT (id) DO UPDATE
SET product_id = EXCLUDED.product_id,
    group_name = EXCLUDED.group_name,
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    is_required = EXCLUDED.is_required,
    sort_order = EXCLUDED.sort_order;

SELECT setval(pg_get_serial_sequence('product_add_ons', 'id'), GREATEST((SELECT MAX(id) FROM product_add_ons), 1), TRUE);

INSERT INTO branches (id, company_id, slug, name, description, image_url, address_line, lat, lng, is_force_closed)
VALUES
  (
    1, 1, 'siam', 'BaanFoodie Siam',
    'Fast-moving flagship branch close to the BTS interchange.',
    'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=80',
    '991 Rama I Rd, Pathum Wan, Bangkok',
    13.7464, 100.5349, FALSE
  ),
  (
    2, 1, 'ari', 'BaanFoodie Ari',
    'Neighbourhood branch tuned for lunch rush and late dinners.',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80',
    'Ari Samphan 7, Phaya Thai, Bangkok',
    13.7809, 100.5432, FALSE
  ),
  (
    3, 1, 'phrom-phong', 'BaanFoodie Phrom Phong',
    'Dense residential delivery coverage with dessert-heavy demand.',
    'https://images.unsplash.com/photo-1521831407885-5dfb36d4d1ec?auto=format&fit=crop&w=900&q=80',
    'Sukhumvit 24, Khlong Toei, Bangkok',
    13.7307, 100.5697, FALSE
  )
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    address_line = EXCLUDED.address_line,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    is_force_closed = EXCLUDED.is_force_closed;

SELECT setval(pg_get_serial_sequence('branches', 'id'), GREATEST((SELECT MAX(id) FROM branches), 1), TRUE);

DELETE FROM branch_operating_hours WHERE branch_id IN (1, 2, 3);

INSERT INTO branch_operating_hours (branch_id, day_of_week, open_time, close_time)
VALUES
  (1, 1, '09:00', '21:00'), (1, 2, '09:00', '21:00'), (1, 3, '09:00', '21:00'),
  (1, 4, '09:00', '21:00'), (1, 5, '09:00', '22:00'), (1, 6, '10:00', '22:00'),
  (1, 0, '10:00', '21:00'),
  (2, 1, '10:00', '20:00'), (2, 2, '10:00', '20:00'), (2, 3, '10:00', '20:00'),
  (2, 4, '10:00', '20:00'), (2, 5, '10:00', '21:00'), (2, 6, '10:00', '21:00'),
  (2, 0, '10:00', '20:00'),
  (3, 1, '11:00', '21:30'), (3, 2, '11:00', '21:30'), (3, 3, '11:00', '21:30'),
  (3, 4, '11:00', '21:30'), (3, 5, '11:00', '22:00'), (3, 6, '11:00', '22:00'),
  (3, 0, '11:00', '21:30');

INSERT INTO branch_products (id, branch_id, product_id, is_enabled, stock_qty, price_override, is_recommended, sort_order)
VALUES
  (1, 1, 1, TRUE, 60, NULL, TRUE, 1),
  (2, 1, 2, TRUE, 40, 99.00, TRUE, 2),
  (3, 1, 3, TRUE, 35, NULL, FALSE, 3),
  (4, 1, 4, TRUE, 120, NULL, FALSE, 4),
  (5, 1, 5, TRUE, 50, NULL, TRUE, 5),
  (6, 1, 6, TRUE, 20, NULL, FALSE, 6),
  (7, 1, 7, TRUE, 24, 115.00, FALSE, 7),
  (8, 1, 8, TRUE, 48, NULL, TRUE, 8),
  (9, 2, 1, TRUE, 35, 92.00, TRUE, 1),
  (10, 2, 2, TRUE, 24, NULL, FALSE, 2),
  (11, 2, 3, TRUE, 28, NULL, TRUE, 3),
  (12, 2, 4, TRUE, 70, NULL, FALSE, 4),
  (13, 2, 5, TRUE, 30, 89.00, FALSE, 5),
  (14, 2, 7, TRUE, 18, NULL, TRUE, 6),
  (15, 2, 8, TRUE, 32, NULL, FALSE, 7),
  (16, 3, 1, TRUE, 44, NULL, TRUE, 1),
  (17, 3, 3, TRUE, 22, 104.00, FALSE, 2),
  (18, 3, 4, TRUE, 80, NULL, FALSE, 3),
  (19, 3, 6, TRUE, 25, 75.00, TRUE, 4),
  (20, 3, 7, TRUE, 20, NULL, TRUE, 5),
  (21, 3, 8, TRUE, 26, NULL, FALSE, 6)
ON CONFLICT (id) DO UPDATE
SET branch_id = EXCLUDED.branch_id,
    product_id = EXCLUDED.product_id,
    is_enabled = EXCLUDED.is_enabled,
    stock_qty = EXCLUDED.stock_qty,
    price_override = EXCLUDED.price_override,
    is_recommended = EXCLUDED.is_recommended,
    sort_order = EXCLUDED.sort_order;

SELECT setval(pg_get_serial_sequence('branch_products', 'id'), GREATEST((SELECT MAX(id) FROM branch_products), 1), TRUE);

COMMIT;
