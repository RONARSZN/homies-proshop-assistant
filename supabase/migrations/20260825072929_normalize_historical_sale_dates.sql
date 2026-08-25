update public.sales
set sold_at = sold_at + interval '12 hours'
where is_historical = true;
