type FieldErrorProps = {
  id: string;
  message: string | undefined;
};

export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="mt-2 text-sm text-error">
      {message}
    </p>
  );
}
