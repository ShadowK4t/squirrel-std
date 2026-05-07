SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'task_attachments_type_check';
