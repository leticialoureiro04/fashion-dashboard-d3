@echo off
cd /d "%~dp0"
echo.
echo Fashion Analytics Dashboard
echo.
echo A abrir servidor local em:
echo http://localhost:8000
echo.
echo Mantem esta janela aberta enquanto usas o dashboard.
echo Para parar, carrega em CTRL+C.
echo.
py -m http.server 8000
pause
