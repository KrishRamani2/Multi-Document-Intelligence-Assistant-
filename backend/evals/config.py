"""
Benchmark Config - 100 test queries based on CRAG-style format
Compatible with RAGAS evaluation
"""

BENCHMARK_CONFIG = {
    "name": "rag_eval_100",
    "description": "100 RAG evaluation queries based on CRAG benchmark format",
    "num_queries": 100,
    "retrieval_modes": ["basic", "hybrid", "multi_query", "multi_vector"],
    "top_k_values": [5, 10, 20],
    "embedders": ["openai", "huggingface", "gemini"],
}


TEST_QUERIES = [
    {
        "question": "What is the revenue of Apple in 2023?",
        "answer": "Apple's revenue in 2023 was approximately $383 billion",
        "ground_truth_docs": ["financial_report"],
    },
    {
        "question": "Who directed the movie Inception?",
        "answer": "Christopher Nolan directed Inception",
        "ground_truth_docs": ["movie_database"],
    },
    {
        "question": "What year was Tesla founded?",
        "answer": "Tesla was founded in 2003",
        "ground_truth_docs": ["company_info"],
    },
    {
        "question": "What is the capital of France?",
        "answer": "Paris is the capital of France",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "Who wrote Hamlet?",
        "answer": "William Shakespeare wrote Hamlet",
        "ground_truth_docs": ["literature"],
    },
    {
        "question": "What is Bitcoin?",
        "answer": "Bitcoin is a decentralized digital currency",
        "ground_truth_docs": ["crypto"],
    },
    {
        "question": "What is machine learning?",
        "answer": "Machine learning is a subset of AI that enables systems to learn from data",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who is the CEO of Microsoft?",
        "answer": "Satya Nadella is the CEO of Microsoft",
        "ground_truth_docs": ["company_info"],
    },
    {
        "question": "What is the speed of light?",
        "answer": "The speed of light is approximately 299,792,458 meters per second",
        "ground_truth_docs": ["science"],
    },
    {
        "question": "What is DNA?",
        "answer": "DNA carries genetic instructions for development and functioning of living organisms",
        "ground_truth_docs": ["biology"],
    },
    {
        "question": "What happened in the 2008 financial crisis?",
        "answer": "The 2008 financial crisis was a global economic downturn caused by the subprime mortgage crisis",
        "ground_truth_docs": ["finance"],
    },
    {
        "question": "What is Python programming language?",
        "answer": "Python is a high-level, interpreted programming language",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who painted the Mona Lisa?",
        "answer": "Leonardo da Vinci painted the Mona Lisa",
        "ground_truth_docs": ["art"],
    },
    {
        "question": "What is quantum computing?",
        "answer": "Quantum computing uses quantum mechanics to perform computations",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the largest planet in our solar system?",
        "answer": "Jupiter is the largest planet in our solar system",
        "ground_truth_docs": ["astronomy"],
    },
    {
        "question": "What is photosynthesis?",
        "Answer": "Photosynthesis is the process by which plants convert sunlight into energy",
        "ground_truth_docs": ["biology"],
    },
    {
        "question": "Who discovered penicillin?",
        "answer": "Alexander Fleming discovered penicillin",
        "ground_truth_docs": ["science"],
    },
    {
        "question": "What is blockchain?",
        "answer": "Blockchain is a distributed ledger technology",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the meaning of life?",
        "answer": "The meaning of life is a philosophical question without a definitive answer",
        "ground_truth_docs": ["philosophy"],
    },
    {
        "question": "What is the population of Tokyo?",
        "answer": "Tokyo's population is approximately 37 million",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is global warming?",
        "answer": "Global warming is the increase in Earth's average temperature due to greenhouse gases",
        "ground_truth_docs": ["environment"],
    },
    {
        "question": "Who invented the iPhone?",
        "answer": "Steve Jobs introduced the iPhone",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the stock market?",
        "answer": "The stock market is a collection of markets where stocks are traded",
        "ground_truth_docs": ["finance"],
    },
    {
        "question": "What is neural network?",
        "answer": "A neural network is a computing system inspired by biological neural networks",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the tallest building in the world?",
        "answer": "The Burj Khalifa is the tallest building in the world",
        "ground_truth_docs": ["architecture"],
    },
    {
        "question": "What is cryptocurrency?",
        "answer": "Cryptocurrency is a digital or virtual currency secured by cryptography",
        "ground_truth_docs": ["crypto"],
    },
    {
        "question": "Who wrote Romeo and Juliet?",
        "answer": "William Shakespeare wrote Romeo and Juliet",
        "ground_truth_docs": ["literature"],
    },
    {
        "question": "What is artificial intelligence?",
        "answer": "AI is the simulation of human intelligence by machines",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Great Wall of China?",
        "answer": "The Great Wall of China is a series of fortifications built along the historic northern borders of China",
        "ground_truth_docs": ["history"],
    },
    {
        "question": "What is cloud computing?",
        "answer": "Cloud computing is the delivery of computing services over the internet",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who painted Starry Night?",
        "answer": "Vincent van Gogh painted Starry Night",
        "ground_truth_docs": ["art"],
    },
    {
        "question": "What is data science?",
        "answer": "Data science uses scientific methods to extract knowledge from data",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Amazon rainforest?",
        "answer": "The Amazon rainforest is a tropical rainforest in South America",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is Kubernetes?",
        "answer": "Kubernetes is a container orchestration platform",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who is Elon Musk?",
        "answer": "Elon Musk is the CEO of Tesla and SpaceX",
        "ground_truth_docs": ["biography"],
    },
    {
        "question": "What is the Eiffel Tower?",
        "answer": "The Eiffel Tower is a wrought-iron lattice tower in Paris",
        "ground_truth_docs": ["architecture"],
    },
    {
        "question": "What is natural language processing?",
        "answer": "NLP is a branch of AI that helps computers understand human language",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Mediterranean Sea?",
        "answer": "The Mediterranean Sea is a sea connected to the Atlantic Ocean",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is deep learning?",
        "answer": "Deep learning is a subset of machine learning using neural networks",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who invented the printing press?",
        "answer": "Johannes Gutenberg invented the printing press",
        "ground_truth_docs": ["history"],
    },
    {
        "question": "What is the Louvre?",
        "answer": "The Louvre is a world-famous art museum in Paris",
        "ground_truth_docs": ["culture"],
    },
    {
        "question": "What is SQL?",
        "answer": "SQL is a language for managing relational databases",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Pacific Ocean?",
        "answer": "The Pacific Ocean is the largest and deepest ocean on Earth",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is Docker?",
        "answer": "Docker is a platform for containerized applications",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who painted The Scream?",
        "answer": "Edvard Munch painted The Scream",
        "ground_truth_docs": ["art"],
    },
    {
        "question": "What is the internet?",
        "answer": "The internet is a global network of computers",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is machine vision?",
        "answer": "Machine vision is the technology for automatic image acquisition and processing",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Hoover Dam?",
        "answer": "The Hoover Dam is a concrete arch-gravity dam in Nevada",
        "ground_truth_docs": ["engineering"],
    },
    {
        "question": "What is Git?",
        "answer": "Git is a distributed version control system",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who invented the telephone?",
        "answer": "Alexander Graham Bell invented the telephone",
        "ground_truth_docs": ["history"],
    },
    {
        "question": "What is Big Data?",
        "answer": "Big Data refers to large and complex data sets",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Great Depression?",
        "answer": "The Great Depression was a severe worldwide economic downturn in the 1930s",
        "ground_truth_docs": ["history"],
    },
    {
        "question": "What is object detection?",
        "answer": "Object detection is a computer vision technique for locating objects in images",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Niagara Falls?",
        "answer": "Niagara Falls is a group of three waterfalls on the US-Canada border",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is API?",
        "answer": "API is a set of protocols for building software applications",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who painted The Last Supper?",
        "answer": "Leonardo da Vinci painted The Last Supper",
        "ground_truth_docs": ["art"],
    },
    {
        "question": "What is the Thames River?",
        "answer": "The Thames River flows through London",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is DevOps?",
        "answer": "DevOps is a set of practices combining software development and IT operations",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is reinforcement learning?",
        "answer": "Reinforcement learning is a type of machine learning where agents learn from rewards",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Colosseum?",
        "answer": "The Colosseum is an ancient amphitheater in Rome",
        "ground_truth_docs": ["history"],
    },
    {
        "question": "What is microservices?",
        "answer": "Microservices is an architectural style for building applications as a set of services",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who invented the light bulb?",
        "answer": "Thomas Edison invented the practical light bulb",
        "ground_truth_docs": ["history"],
    },
    {
        "question": "What is the Grand Canyon?",
        "answer": "The Grand Canyon is a steep canyon in Arizona",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is transfer learning?",
        "answer": "Transfer learning is a technique where a model is repurposed for a new task",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Empire State Building?",
        "answer": "The Empire State Building is a skyscraper in New York City",
        "ground_truth_docs": ["architecture"],
    },
    {
        "question": "What is computer vision?",
        "answer": "Computer vision enables computers to understand visual information",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who founded Amazon?",
        "answer": "Jeff Bezos founded Amazon",
        "ground_truth_docs": ["business"],
    },
    {
        "question": "What is the Suez Canal?",
        "answer": "The Suez Canal connects the Mediterranean Sea to the Red Sea",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is MongoDB?",
        "answer": "MongoDB is a document-oriented database",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is edge computing?",
        "answer": "Edge computing brings computation closer to data sources",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who painted The Persistence of Memory?",
        "answer": "Salvador Dalí painted The Persistence of Memory",
        "ground_truth_docs": ["art"],
    },
    {
        "question": "What is Redis?",
        "answer": "Redis is an in-memory data structure store",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is Kubernetes used for?",
        "answer": "Kubernetes is used for container orchestration",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Panama Canal?",
        "answer": "The Panama Canal connects the Atlantic and Pacific Oceans",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is GPT in AI?",
        "answer": "GPT is a language model using transformer architecture",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who founded Google?",
        "answer": "Larry Page and Sergey Brin founded Google",
        "ground_truth_docs": ["business"],
    },
    {
        "question": "What is the Dead Sea?",
        "answer": "The Dead Sea is a salt lake between Israel and Jordan",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is Flask in Python?",
        "answer": "Flask is a lightweight web framework for Python",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is GAN in deep learning?",
        "answer": "GAN stands for Generative Adversarial Network",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Pyrenees?",
        "answer": "The Pyrenees is a mountain range between France and Spain",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is PostgreSQL?",
        "answer": "PostgreSQL is an open-source relational database",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who developed Windows?",
        "answer": "Microsoft developed Windows",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Urals?",
        "answer": "The Urals is a mountain range in Russia",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is TensorFlow?",
        "answer": "TensorFlow is a machine learning framework by Google",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Berlin Wall?",
        "answer": "The Berlin Wall was a barrier dividing East and West Berlin",
        "ground_truth_docs": ["history"],
    },
    {
        "question": "What is PyTorch?",
        "answer": "PyTorch is a machine learning framework by Facebook",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who invented the airplane?",
        "answer": "The Wright brothers invented the airplane",
        "ground_truth_docs": ["history"],
    },
    {
        "question": "What is the Andes?",
        "answer": "The Andes is the longest continental mountain range in the world",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is serverless computing?",
        "answer": "Serverless computing allows building apps without managing servers",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Sphinx?",
        "answer": "The Sphinx is a limestone statue in Egypt",
        "ground_truth_docs": ["history"],
    },
    {
        "question": "What is Elasticsearch?",
        "answer": "Elasticsearch is a search and analytics engine",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Alps?",
        "answer": "The Alps is a mountain range in Europe",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is a transformer model?",
        "answer": "A transformer model uses self-attention mechanisms",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "Who painted Water Lilies?",
        "answer": "Claude Monet painted Water Lilies",
        "ground_truth_docs": ["art"],
    },
    {
        "question": "What is IoT?",
        "answer": "IoT connects physical devices to the internet",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is SaaS?",
        "answer": "SaaS is software delivered over the internet",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Mariana Trench?",
        "answer": "The Mariana Trench is the deepest ocean trench",
        "ground_truth_docs": ["geography"],
    },
    {
        "question": "What is REST API?",
        "answer": "REST API is an architectural style for web services",
        "ground_truth_docs": ["technology"],
    },
    {
        "question": "What is the Silk Road?",
        "answer": "The Silk Road was an ancient trade route connecting China to Europe",
        "ground_truth_docs": ["history"],
    },
    {
        "question": "What is GraphQL?",
        "answer": "GraphQL is a query language for APIs",
        "ground_truth_docs": ["technology"],
    },
]

# Ensure exactly 100 items
TEST_QUERIES = TEST_QUERIES[:100]
