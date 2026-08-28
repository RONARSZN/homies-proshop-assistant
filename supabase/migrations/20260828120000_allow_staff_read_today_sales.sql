/* STAFF can see today's counter activity without gaining access to history or
   mutation paths. Boundaries are evaluated in the shop's Manila timezone. */
create policy sales_read_staff_today
on public.sales for select to authenticated
using (
  (select private.current_user_role_v2()) = 'staff'
  and sold_at >= (date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')
  and sold_at < ((date_trunc('day', now() at time zone 'Asia/Manila') + interval '1 day') at time zone 'Asia/Manila')
);

create policy sale_items_read_staff_today
on public.sale_items for select to authenticated
using (
  (select private.current_user_role_v2()) = 'staff'
  and exists (
    select 1
    from public.sales
    where sales.id = sale_items.sale_id
      and sales.sold_at >= (date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')
      and sales.sold_at < ((date_trunc('day', now() at time zone 'Asia/Manila') + interval '1 day') at time zone 'Asia/Manila')
  )
);
