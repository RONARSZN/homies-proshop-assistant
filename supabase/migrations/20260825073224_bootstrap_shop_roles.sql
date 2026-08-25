insert into public.profiles (id, full_name, role)
select id, 'Mark Louie', 'owner'
from auth.users
where email = 'marklouiecamomot.channel@gmail.com'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

insert into public.profiles (id, full_name, role)
select id, 'Mark Louie', 'manager'
from auth.users
where email = 'marklouie.business@gmail.com'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

insert into public.profiles (id, full_name, role)
select id, 'Staging Staff', 'staff'
from auth.users
where email = 'staging.staff.1780701478@homies.local'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;
