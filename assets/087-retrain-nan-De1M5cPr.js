const n=`---
title: Retrain Model when Nan Occurs
date: 2022-07-22
id: blog087
tag: pytorch, deep-learning
toc: false
intro: Sometimes a loss becomes nan in rare occasion (e.g., it occurs once per 5~7 epochs), in this case we record a script to restart the training using the latest weight.
---

Given a training function with the following interface:

\`\`\`python
class TrainingErrorMessage(TypedDict):
    curr_epoch: int
    message: Literal["nan_loss"]

def train(
    faster_rcnn: FasterRCNNResnet50FPN,
    lr,
    start_epoch,
    epochs,
    save_weight_interval=5
) -> None | TrainingErrorMessage:
    ...
    for epoch in range(epochs):
        for batch_id, data in enumerate(tqdm(data_loader)):
            ...
            total_loss = ...

            if torch.isnan(total_loss):
                return TrainingErrorMessage(message="nan_loss", curr_epoch=epoch)
    ...
\`\`\`

Then we wrap the function \`train\` by

\`\`\`python
def train_with_nan(
    faster_rcnn,
    lr=1e-5,
    start_epoch=1,
    epoches=60,
    save_weight_interval=5
):
    continue_training = True
    restart_ep = start_epoch
    restart_for_eps = epoches
    curr_model = faster_rcnn

    while continue_training:
        result = train(
            curr_model,
            lr,
            restart_ep,
            restart_for_eps,
            save_weight_interval
        )
        if result is not None:
            message = result["message"]
            if message == "nan_loss":
                curr_epoch = result["curr_epoch"]
                if curr_epoch > (start_epoch + epoches):
                    print("stop training")
                    continue_training = False
                else:
                    continue_training = True
                    model_latest_epoch = (curr_epoch-1) - ((curr_epoch-1) % save_weight_interval)
                    restart_ep = model_latest_epoch + 1
                    restart_for_eps = epoches - (model_latest_epoch - start_epoch)
                    model_path = f"pths/model_epoch_{model_latest_epoch}.pth"
                    curr_model = FasterRCNNResnet50FPN().to(device)
                    curr_model.load_state_dict(torch.load(model_path))
                    curr_model.train()

                    print(f"Get nan loss, restart training at epoch {restart_ep} for additional {restart_for_eps} epochs" + "\\x1B[0K")
                    print(f"Loading weight from {model_path}" + "\\x1B[0K")
            else:
                continue_training = False
        else:
            continue_training = False
\`\`\`
`;export{n as default};
