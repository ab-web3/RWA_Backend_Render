from fastapi import HTTPException
import numpy as np

# Your saved artifact dictionary should already be loaded.
# It contains "ann", "preprocessor", and "fusion".
#
# If your loaded dictionary variable is named "artifacts":
ann_model = artifacts["ann"]
feature_preprocessor = artifacts["preprocessor"]


@app.post("/predict")
def predict(request: PredictionRequest):
    try:
        # The frontend sends: {"features": {...}}
        features = request.features

        # Convert the submitted feature dictionary to a one-row DataFrame.
        import pandas as pd
        input_df = pd.DataFrame([features])

        # Apply the fitted preprocessing pipeline.
        transformed_input = feature_preprocessor.transform(input_df)

        # Run the trained ANN.
        predicted_class = ann_model.predict(transformed_input)[0]
        probabilities = ann_model.predict_proba(transformed_input)[0]

        return {
            "status": "success",
            "model": "ANN",
            "prediction": int(predicted_class),
            "class_probabilities": {
                str(label): float(probability)
                for label, probability in zip(
                    ann_model.classes_,
                    probabilities
                )
            }
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"ANN prediction failed: {str(exc)}"
        )
