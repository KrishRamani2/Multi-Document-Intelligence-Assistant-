I would want to get a file

Each file has a metadata unique to its format we will have a pydantic class for it

THe File get processed and converted into chunks 

Each chunk has a metadata maybe its an image , table , chart or json or anything the enums must be defined

thats the part of the extractors 

Now its our focus is that only

We must support different file types and model 

- PDF
- WebPages
- MarkDown
- Yt Links
- Audio
- Strucutred 
  - Json
  - CSV
(thinking of adding its Summaray like a json and csv summarizer)
- Image
(thinking of adding its Summaray )

We must also have a redact and cleanner


We will have Each file type type_extract.py
- Each file will have file_metadata special to the type and also generic things that must be 
  Each CHunk has metadata