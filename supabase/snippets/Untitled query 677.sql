alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'task_assigned',
    'mentioned',
    'review_requested',
    'task_accepted',
    'task_rejected',
    'meeting_assignment'
  ));
