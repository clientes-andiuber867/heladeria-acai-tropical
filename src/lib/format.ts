export const money = (value: number) =>
  `Bs ${Number(value).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const day = (value: Date) => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/La_Paz",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  } catch {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
};

export const stamp = (value: string) => {
  try {
    return new Date(value).toLocaleString("es-BO", {
      timeZone: "America/La_Paz",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return new Date(value).toLocaleString();
  }
};
export const dateBounds = (from: string, to: string) => ({
  start: `${from}T00:00:00-04:00`,
  end: `${to}T23:59:59.999-04:00`,
});
export function errorMessage(error: unknown) {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "No se pudo completar la operación.";
  const translations: Record<string, string> = {
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "Email not confirmed": "Confirma tu correo antes de ingresar.",
    "Failed to fetch": "No hay conexión. Revisa internet e inténtalo de nuevo.",
    "User already registered": "Ya existe un usuario con ese correo.",
    "New password should be different from the old password.":
      "La nueva contraseña debe ser diferente a la anterior.",
  };
  return translations[text] || text;
}
export function periodDates(period: string) {
  const now = new Date(),
    today = day(now);
  if (period === "today") return { from: today, to: today };
  const [year, month] = today.split("-").map(Number);
  if (period === "lastmonth") {
    const previous = new Date(Date.UTC(year, month - 1, 0, 12));
    return { from: day(previous).slice(0, 7) + "-01", to: day(previous) };
  }
  return { from: today.slice(0, 7) + "-01", to: today };
}
