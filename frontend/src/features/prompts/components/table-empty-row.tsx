export function TableEmptyRow({ message }: { message: string }) {
  return (
    <tr className="border-t border-border/30">
      <td className="px-6 py-14 text-center text-sm text-muted-foreground" colSpan={6}>
        {message}
      </td>
    </tr>
  );
}
