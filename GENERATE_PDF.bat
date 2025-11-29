@echo off
echo ========================================
echo   تحويل الفلو جارت إلى PDF بحجم A3
echo ========================================
echo.

echo جاري التحقق من تثبيت puppeteer...
if not exist "node_modules\puppeteer" (
    echo تثبيت puppeteer...
    call npm install puppeteer --save-dev
)

echo.
echo جاري تحويل الفلو جارت إلى PDF...
echo قد يستغرق هذا بضع دقائق...
echo.

node generate-flowchart-pdf.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   تم إنشاء PDF بنجاح!
    echo   الملف: FLOWCHART_A3.pdf
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   حدث خطأ أثناء التحويل
    echo   راجع التعليمات في GENERATE_PDF_INSTRUCTIONS.md
    echo ========================================
)

pause



