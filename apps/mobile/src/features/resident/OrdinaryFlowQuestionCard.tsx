import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton, BodyText, FieldLabel, InputField, SectionCard } from "../../components/ui";
import { DynamicFlowQuestion } from "../../api/contracts";
import { tokens } from "../../theme/tokens";
import { font } from "../../theme/typography";
import { QuestionDraft, serializeDraftAnswer } from "./ordinaryFlowAdapter";

type Props = {
  question: DynamicFlowQuestion | null;
  draft: QuestionDraft;
  onChangeDraft: (next: QuestionDraft) => void;
  onSubmitAnswer: (answer: unknown) => void;
  submitting?: boolean;
};

const urgencyOptions = ["Low", "Medium", "High", "Emergency"];

export function OrdinaryFlowQuestionCard({
  question,
  draft,
  onChangeDraft,
  onSubmitAnswer,
  submitting = false,
}: Props) {
  if (!question) return null;
  const activeQuestion = question;

  function update<K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) {
    onChangeDraft({ ...draft, [key]: value });
  }

  function updateLocation(field: keyof QuestionDraft["location"], value: string) {
    onChangeDraft({
      ...draft,
      location: { ...draft.location, [field]: value },
    });
  }

  function updateSchedule(field: keyof QuestionDraft["schedule"], value: string) {
    onChangeDraft({
      ...draft,
      schedule: { ...draft.schedule, [field]: value },
    });
  }

  function submitDraftAnswer() {
    onSubmitAnswer(serializeDraftAnswer(activeQuestion, draft));
  }

  const optionChips = question.options || [];

  return (
    <SectionCard style={styles.card}>
      <Text style={styles.prompt}>{activeQuestion.prompt}</Text>
      {activeQuestion.description ? <BodyText muted>{activeQuestion.description}</BodyText> : null}

      {(activeQuestion.inputType === "single_select" || activeQuestion.inputType === "yes_no") && optionChips.length ? (
        <View style={styles.optionWrap}>
          {optionChips.map((option) => (
            <Pressable
              key={option.id}
              onPress={() =>
                onSubmitAnswer({
                  optionKey: option.optionKey,
                  value: option.value,
                  text: option.label,
                })
              }
              style={styles.chip}
              disabled={submitting}
            >
              <Text style={styles.chipText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {activeQuestion.inputType === "yes_no" && !optionChips.length ? (
        <View style={styles.optionWrap}>
          {["Yes", "No"].map((label) => (
            <Pressable
              key={label}
              onPress={() => onSubmitAnswer({ text: label, value: label.toLowerCase() })}
              style={styles.chip}
              disabled={submitting}
            >
              <Text style={styles.chipText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {activeQuestion.inputType === "urgency" ? (
        <View style={styles.optionWrap}>
          {(optionChips.length ? optionChips.map((option) => option.label) : urgencyOptions).map((label) => (
            <Pressable
              key={label}
              onPress={() => onSubmitAnswer({ text: label, value: label.toLowerCase() })}
              style={styles.chip}
              disabled={submitting}
            >
              <Text style={styles.chipText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {activeQuestion.inputType === "multi_select" ? (
        <>
          <View style={styles.optionWrap}>
            {optionChips.map((option) => {
              const selected = draft.multiSelectKeys.includes(option.optionKey);
              return (
                <Pressable
                  key={option.id}
                  onPress={() =>
                    update(
                      "multiSelectKeys",
                      selected
                        ? draft.multiSelectKeys.filter((value) => value !== option.optionKey)
                        : [...draft.multiSelectKeys, option.optionKey],
                    )
                  }
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <AppButton
            onPress={submitDraftAnswer}
            disabled={submitting || draft.multiSelectKeys.length === 0}
          >
            {submitting ? "Saving..." : "Save selection"}
          </AppButton>
        </>
      ) : null}

      {["text", "number"].includes(activeQuestion.inputType) ? (
        <>
          <InputField
            multiline={activeQuestion.inputType === "text"}
            keyboardType={activeQuestion.inputType === "number" ? "number-pad" : "default"}
            placeholder={activeQuestion.inputType === "number" ? "Type a number" : "Type your answer"}
            value={draft.text}
            onChangeText={(value) => update("text", value)}
          />
          <AppButton onPress={submitDraftAnswer} disabled={submitting || !draft.text.trim()}>
            {submitting ? "Saving..." : "Send answer"}
          </AppButton>
        </>
      ) : null}

      {(activeQuestion.inputType === "location" || activeQuestion.inputType === "estate") ? (
        <>
          <FieldLabel>Address</FieldLabel>
          <InputField placeholder="Street or address" value={draft.location.address} onChangeText={(value) => updateLocation("address", value)} />
          <FieldLabel>Estate or area</FieldLabel>
          <InputField placeholder="Estate, area, or landmark" value={draft.location.estateName} onChangeText={(value) => updateLocation("estateName", value)} />
          <View style={styles.rowFields}>
            <View style={styles.fieldGrow}>
              <FieldLabel>State</FieldLabel>
              <InputField placeholder="State" value={draft.location.state} onChangeText={(value) => updateLocation("state", value)} />
            </View>
            <View style={styles.fieldGrow}>
              <FieldLabel>LGA</FieldLabel>
              <InputField placeholder="LGA" value={draft.location.lga} onChangeText={(value) => updateLocation("lga", value)} />
            </View>
          </View>
          <FieldLabel>Unit or flat</FieldLabel>
          <InputField placeholder="Optional unit" value={draft.location.unit} onChangeText={(value) => updateLocation("unit", value)} />
          <AppButton onPress={submitDraftAnswer} disabled={submitting || !draft.location.address.trim()}>
            {submitting ? "Saving..." : "Save location"}
          </AppButton>
        </>
      ) : null}

      {activeQuestion.inputType === "date" ? (
        <>
          <FieldLabel>Date</FieldLabel>
          <InputField placeholder="YYYY-MM-DD" value={draft.schedule.date} onChangeText={(value) => updateSchedule("date", value)} />
          <AppButton onPress={submitDraftAnswer} disabled={submitting || !draft.schedule.date.trim()}>
            {submitting ? "Saving..." : "Save date"}
          </AppButton>
        </>
      ) : null}

      {activeQuestion.inputType === "time" ? (
        <>
          <FieldLabel>Time</FieldLabel>
          <InputField placeholder="HH:MM" value={draft.schedule.time} onChangeText={(value) => updateSchedule("time", value)} />
          <AppButton onPress={submitDraftAnswer} disabled={submitting || !draft.schedule.time.trim()}>
            {submitting ? "Saving..." : "Save time"}
          </AppButton>
        </>
      ) : null}

      {activeQuestion.inputType === "datetime" ? (
        <>
          <FieldLabel>Date and time</FieldLabel>
          <InputField
            placeholder="YYYY-MM-DD HH:MM"
            value={draft.schedule.dateTime}
            onChangeText={(value) => updateSchedule("dateTime", value)}
          />
          <AppButton onPress={submitDraftAnswer} disabled={submitting || !draft.schedule.dateTime.trim()}>
            {submitting ? "Saving..." : "Save schedule"}
          </AppButton>
        </>
      ) : null}

      {activeQuestion.inputType === "file" ? (
        <>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>File uploads are not yet wired on mobile</Text>
            <Text style={styles.placeholderBody}>Add a note now and continue. Image upload can be added in the next pass without changing the backend flow.</Text>
          </View>
          <TextInput
            multiline
            placeholder="Optional file note"
            placeholderTextColor={tokens.color.textMuted}
            style={styles.textArea}
            value={draft.fileNote}
            onChangeText={(value) => update("fileNote", value)}
          />
          <View style={styles.optionWrap}>
            <AppButton onPress={submitDraftAnswer} disabled={submitting}>
              {submitting ? "Saving..." : "Continue"}
            </AppButton>
            <AppButton variant="secondary" onPress={() => onSubmitAnswer({ files: [], text: "Skipped file upload on mobile" })} disabled={submitting}>
              Skip for now
            </AppButton>
          </View>
        </>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  prompt: {
    ...font("500"),
    color: tokens.color.text,
    fontSize: 18,
    lineHeight: 23,
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: tokens.color.primary,
  },
  chipText: {
    ...font("400"),
    color: tokens.color.text,
    fontSize: 14,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  rowFields: {
    flexDirection: "row",
    gap: 12,
  },
  fieldGrow: {
    flex: 1,
    gap: 8,
  },
  placeholderCard: {
    backgroundColor: tokens.color.surfaceMuted,
    borderRadius: 18,
    gap: 4,
    padding: 14,
  },
  placeholderTitle: {
    ...font("500"),
    color: tokens.color.text,
    fontSize: 15,
  },
  placeholderBody: {
    ...font("400"),
    color: tokens.color.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  textArea: {
    ...font("400"),
    backgroundColor: tokens.color.surfaceMuted,
    borderRadius: tokens.radius.md,
    color: tokens.color.text,
    minHeight: 110,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    textAlignVertical: "top",
  },
});


