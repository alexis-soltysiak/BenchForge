export function TableEmptyRow({ message }: { message: string }) {
  return (
    <tr className="border-t border-border/30">
      <td className="px-5 py-12 text-center text-sm text-muted-foreground/50" colSpan={5}>
        {message}
      </td>
    </tr>
  );
}
