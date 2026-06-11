#!/bin/bash
# Abre um terminal com comando no diretório do projeto.

open_project_terminal() {
  local title=$1
  local cmd=$2
  local root=$3

  local inner
  inner="cd $(printf '%q' "$root") && $cmd; echo; echo '--- ${title} encerrado (Enter para fechar) ---'; read -r"

  if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="$title" -- bash -lc "$inner" &
  elif command -v konsole >/dev/null 2>&1; then
    konsole --new-tab -p "tabtitle=$title" -e bash -lc "$inner" &
  elif command -v xfce4-terminal >/dev/null 2>&1; then
    xfce4-terminal --title="$title" -e bash -lc "$inner" &
  elif command -v kitty >/dev/null 2>&1; then
    kitty --title="$title" bash -lc "$inner" &
  elif command -v xterm >/dev/null 2>&1; then
    xterm -title "$title" -hold -e bash -lc "$inner" &
  else
    echo "❌ Nenhum emulador de terminal encontrado."
    echo "   Rode manualmente em 3 terminais:"
    echo "   cd $root && $cmd"
    return 1
  fi
}
