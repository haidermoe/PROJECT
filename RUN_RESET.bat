@echo off
echo ========================================
echo إعادة تعيين قواعد البيانات
echo ========================================
echo.
echo ⚠️ تحذير: هذا سيحذف جميع البيانات!
echo.
pause

REM محاولة العثور على MySQL
set MYSQL_PATH=
if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" (
    set MYSQL_PATH=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe
) else if exist "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe" (
    set MYSQL_PATH=C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe
) else if exist "C:\xampp\mysql\bin\mysql.exe" (
    set MYSQL_PATH=C:\xampp\mysql\bin\mysql.exe
) else if exist "C:\wamp64\bin\mysql\mysql8.0.27\bin\mysql.exe" (
    set MYSQL_PATH=C:\wamp64\bin\mysql\mysql8.0.27\bin\mysql.exe
) else (
    echo ❌ لم يتم العثور على MySQL!
    echo.
    echo يرجى تشغيل السكريبت يدوياً:
    echo 1. افتح MySQL Command Line Client
    echo 2. اكتب: source reset_databases.sql
    echo.
    pause
    exit /b 1
)

echo ✅ تم العثور على MySQL في: %MYSQL_PATH%
echo.
echo جاري تشغيل السكريبت...
echo.

"%MYSQL_PATH%" -u root -p < reset_databases.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ تم تشغيل السكريبت بنجاح!
) else (
    echo.
    echo ❌ حدث خطأ أثناء تشغيل السكريبت
)

echo.
pause

