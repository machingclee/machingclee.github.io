const e=`---
title: "Transformer 2: A More in Depth Training with Real World Dataset Using Modern NLP Dataset Pipeline in Pytorch"
date: 2022-08-17
id: blog089
tag: pytorch, deep-learning
intro: Continuation of the previous blog post on transformer, discuss more modern pipeline for training a transformer (or any NLP task in general) using the latest torchtext.
---

### Training: Real World Dataset

#### Repository

The code block below are partially taken from my repo:

- https://github.com/machingclee/2022-07-04-transformer-from-scratch

#### New Practice from torchtext 0.10.1 onwards

Old NLP material in pytorch usually import the following:

\`\`\`python
# or from torchtext.legacy.data
from torchtext.data import Field, Field, BucketIterator, TabularDataset
\`\`\`

but these are completely removed from torchtext 0.10.1 onwards. It seems that the official pytorch suggests users creating their dataset via _traditional_ classes:

\`\`\`python
from torch.utils.data import Dataset, DataLoader
\`\`\`

#### spacy package

- We will rely on a package called \`spacy\` for tokenization. We will need this in our \`Corpus\` class, which is called implicitly in \`get_tokenizer\` imported from \`torchtext.data.utils\`.

- We install the \`spacy\` and the desired lanauges by following the guide in https://spacy.io/usage.

#### Download Source of EN-JP Dataset

Interested reader can download it from: https://nlp.stanford.edu/projects/jesc/

#### Prepare Dataset Pipeline

Suppose that our dataset is a \`txt\` file in which every line is an English sentence paired with its Japanese translation, separated by \`\\t\`:

\`\`\`none
or the relative risk of drugs	ほぼ無関係です
gail, are you drunk?	ゲイル 酔ってる?
be careful.	注意しろ
...
\`\`\`

Let's first define our \`Corpus\` class that iterates the dataset to provide these sentences.

Note that \`get_src_sentence_iter\` and \`get_tgt_sentence_iter\` **_below_** are dependent on the structure of the dataset.

\`\`\`python
import pickle
import torch
from collections import Counter
from random import shuffle
from torchtext.data.utils import get_tokenizer
from torch.utils.data import Dataset, DataLoader
from torchtext.vocab import vocab, Vocab
from src.device import device
from src import config
from typing import Optional

class Corpus:
    def __init__(
            self,
            src_lang="en_core_web_sm",
            tgt_lang="ja_core_news_sm",
            delimiter="\\t",
            src_vocab: Optional[Vocab] = None,
            tgt_vocab: Optional[Vocab] = None
        ):
        # the lang keys are used in defining "field object"
        # which is exactly the csv's header, the column name, the json key, etc.
        self.delimiter=delimiter

        self.src_tokenizer = get_tokenizer("spacy", language=src_lang)
        self.tgt_tokenizer = get_tokenizer("spacy", language=tgt_lang)

        src_counter = Counter()
        tgt_counter =  Counter()

        if src_vocab is not None and tgt_vocab is not None:
            self.src_vocab = src_vocab
            self.tgt_vocab = tgt_vocab
        else:
            for src_line in self.get_src_sentence_iter():
                src_counter.update(self.src_tokenizer(src_line))
            for tgt_line in self.get_tgt_sentence_iter():
                tgt_counter.update(self.tgt_tokenizer(tgt_line))

            # for label, line in
            self.src_vocab = vocab(
                src_counter,
                min_freq=2,
                specials=('<ukn>', '<pad>')
            )
            self.tgt_vocab = vocab(
                tgt_counter,
                min_freq=2,
                specials=('<ukn>', '<sos>', '<eos>', '<pad>')
            )

    def get_src_sentence_iter(self):
        with open(config.data_path, encoding="utf-8") as f:
            for line in f:
                src_line, _ = line.split(self.delimiter)
                yield src_line

    def get_tgt_sentence_iter(self):
        with open(config.data_path, encoding="utf-8") as f:
            for line in f:
                _, tgt_line = line.split(self.delimiter)
                yield tgt_line

    def save_vocabs(self):
        vocabs = {
            "src": self.src_vocab,
            "tgt": self.tgt_vocab
        }
        for lang, vocab in vocabs.items():
            with open(f"{lang}.pickle", 'wb+') as handle:
                pickle.dump(vocab, handle, protocol=pickle.HIGHEST_PROTOCOL)
\`\`\`

Since creating vocabs involve accessing to all sentences in a dataset, it can take quite long and it is worth saving the vocabs, which include

- \`index_to_word\` (obtained by \`Vocab.get_itos()\`) and
- \`word_to_index\` (obtained by \`Vocab.get_stoi()\`)
  somewhere else so that we can reuse later without iterating the whole dataset again, that's why we have the \`save_vocabs\` method.

After saving the vocabs into \`pickle\` files, we can retrieve it by the class:

\`\`\`python
class Vocabs:
    src_vocab = None
    tgt_vocab = None

    def __init__(self, src_vocab_pickle_path, tgt_vocab_pickle_path):
        self.src_vocab_pickle_path = src_vocab_pickle_path
        self.tgt_vocab_pickle_path = tgt_vocab_pickle_path

    def get_src_vocab(self) -> Vocab:
        if Vocabs.src_vocab is None:
            with open(self.src_vocab_pickle_path, 'rb') as handle:
                Vocabs.src_vocab = pickle.load(handle)

        return Vocabs.src_vocab

    def get_tgt_vocab(self):
        if Vocabs.tgt_vocab is None:
            with open(self.tgt_vocab_pickle_path, 'rb') as handle:
                Vocabs.tgt_vocab = pickle.load(handle)

        return Vocabs.tgt_vocab
\`\`\`

Now our NLP dataset dedicated to Transformer becomes:

\`\`\`python
class TransformerDataset(Dataset):
    def __init__(self, corpus: Corpus):
        self.corpus = corpus
        self.src_sentences = list(self.corpus.get_src_sentence_iter())
        self.tgt_sentences = list(self.corpus.get_tgt_sentence_iter())

    def __getitem__(self, index):
        src_text = self.src_sentences[index]
        tgt_text = self.tgt_sentences[index]

        src_stoi = self.corpus.src_vocab.get_stoi()
        tgt_stoi =  self.corpus.tgt_vocab.get_stoi()

        src_tokens= self.corpus.src_tokenizer(src_text)
        tgt_tokens = self.corpus.tgt_tokenizer(tgt_text)

        src_pad_len = config.src_max_len - len(src_tokens)
        tgt_pad_len = config.tgt_max_len - len(tgt_tokens)

        if src_pad_len > 0:
            src_idxes = [src_stoi.get(token, src_stoi["<ukn>"]) for token in src_tokens] + [src_stoi["<pad>"]] * src_pad_len
        else:
            src_idxes = [src_stoi.get(token, src_stoi["<ukn>"]) for token in src_tokens[:config.src_max_len]]

        if tgt_pad_len > 0:
            tgt_idxes = [tgt_stoi['<sos>']] + \\
                        [tgt_stoi.get(token, src_stoi["<ukn>"]) for token in tgt_tokens] + \\
                        [tgt_stoi['<eos>']] + \\
                        [tgt_stoi["<pad>"]] * tgt_pad_len
        else:
            tgt_idxes = [tgt_stoi['<sos>']] + \\
                        [tgt_stoi.get(token, src_stoi["<ukn>"]) for token in tgt_tokens[:config.tgt_max_len]] + \\
                        [tgt_stoi['<eos>']]

        return torch.as_tensor(src_idxes, device=device), torch.as_tensor(tgt_idxes, device=device)


    def __len__(self):
        return len(self.src_sentences)
\`\`\`

#### Training Script

According to our dataset output we change our training script as follows, we always feed our model by "indexed" version of our **_naive dataset_**.

\`\`\`python
console_log = ConsoleLog(lines_up_on_end=1)

def train(
    epochs=10,
    use_saved_vocab=False,
    learning_rate=1e-3
):
    if use_saved_vocab:
        vocabs = Vocabs(src_vocab_pickle_path="src.pickle", tgt_vocab_pickle_path="tgt.pickle")
        corpus = Corpus(src_vocab=vocabs.get_src_vocab(), tgt_vocab=vocabs.get_tgt_vocab())
    else:
        corpus = Corpus()
        corpus.save_vocabs()

    src_vocab_size = len(corpus.src_vocab.get_stoi())
    tgt_vocab_size = len(corpus.tgt_vocab.get_stoi())

    transformer = Transformer(
        src_vocab_size=src_vocab_size,
        tgt_vocab_size=tgt_vocab_size
    ).to(device)

    criterion = nn.CrossEntropyLoss(ignore_index=0)
    optimizer = optim.Adamax(transformer.parameters(), lr=learning_rate)
    dataset = TransformerDataset(corpus)
    data_loader = DataLoader(dataset=dataset,
                             batch_size=config.batch_size,
                             shuffle=True
                             )
    # when arrived this step, pickle file must have been saved
    vocabs = Vocabs(src_vocab_pickle_path="src.pickle", tgt_vocab_pickle_path="tgt.pickle")
    src_vocabs = vocabs.get_src_vocab()
    tgt_vocabs = vocabs.get_tgt_vocab()

    for epoch in range(epochs):

        for batch_id, (src_idxes, tgt_idxes) in enumerate(tqdm(data_loader)):
            batch_id += 1
            enc_inputs = src_idxes.to(device)
            dec_inputs = tgt_idxes[:, :-1].to(device)
            dec_outputs = tgt_idxes[:, 1:].to(device)

            outputs, _, _, _ = transformer(
                enc_inputs,
                dec_inputs
            )

            loss = criterion(outputs, dec_outputs.flatten())

            with torch.no_grad():
                console_log.print([
                    ("loss", loss.item())
                ])
                if batch_id % config.visualize_result_per_epochs == 0:
                    visualize(transformer,
                              enc_inputs[0],
                              src_vocabs,
                              tgt_vocabs
                    )

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

        state_dict = transformer.state_dict()
        torch.save(state_dict, os.path.join("pths", f"model_epoch_{epoch}.pth"))
\`\`\`

#### New Translator

Next we build our translator based on the vocab objects:

\`\`\`python
class Translator():
    def __init__(self, transformer: Transformer):
        self.transformer = transformer

    def translate_input_index(self, enc_input, src_start_index, tgt_word_index, tgt_index_word):
        dec_input = torch.zeros(1, 0).type_as(enc_input)
        terminated = False
        next_tgt_word_index = src_start_index
        word_count = 0
        while not terminated:
            dec_input = torch.cat(
                [
                    dec_input.detach(),
                    torch.tensor([[next_tgt_word_index]],dtype=enc_input.dtype).to(device)
                ],
                -1
            )
            word_count += 1
            dec_output_logits, _, _, _= self.transformer(enc_input, dec_input)
            next_tgt_word_index = torch.argmax(dec_output_logits[-1])

            if next_tgt_word_index == tgt_word_index["<eos>"] or word_count == config.tgt_max_len + 1:
                terminated = True

        # remove batch, remove <sos>
        return dec_input.squeeze(0)[1:]
\`\`\`
`;export{e as default};
