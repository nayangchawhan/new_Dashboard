FROM flink:1.18-scala_2.12-java11

RUN apt-get update -y && \
    apt-get install -y python3 python3-pip python3-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /opt/flink/usrlib

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY jobs/ ./jobs/
