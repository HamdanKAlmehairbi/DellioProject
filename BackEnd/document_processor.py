from PyPDF2 import PdfReader
import docx
from fastapi import UploadFile, HTTPException
import io
import logging

class DocumentProcessor:
    """Handles document uploads and text extraction"""
    
    async def extract_text(self, file: UploadFile) -> str:
        """Extract text from uploaded documents"""
        try:
            content = await file.read()
            # For now, assume it's plain text
            return content.decode('utf-8')
        except Exception as e:
            logging.error(f"Document processing error: {str(e)}")
            raise ValueError("Failed to process document")
        
    def _extract_from_pdf(self, content: bytes) -> str:
        """Extract text from PDF content"""
        try:
            pdf = PdfReader(io.BytesIO(content))
            text = ""
            for page in pdf.pages:
                text += page.extract_text() + "\n"
            return text.strip()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")
            
    def _extract_from_docx(self, content: bytes) -> str:
        """Extract text from DOCX content"""
        try:
            doc = docx.Document(io.BytesIO(content))
            return "\n".join([paragraph.text for paragraph in doc.paragraphs])
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing DOCX: {str(e)}")