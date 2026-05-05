const t=`---
title: "CLI Program by Bubble Tea"
date: 2025-03-08
id: blog0368
tag: bubble-tea, go
toc: true
intro: "We record the basic and elements of bubble tea."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Visual Result

[![](/assets/img/2025-03-09-20-13-27.png)](/assets/img/2025-03-09-20-13-27.png)

### Project Structure

![](/assets/img/2025-03-09-03-46-49.png)

### Entrypoint --- How do we start our CLI program?

#### The Model Interface

In \`main.go\` our \`func main()\` will execute the following function:

\`\`\`go{9}
import (
  	"fmt"

    tea "github.com/charmbracelet/bubbletea"
)

func Start() {
  ... // instantiation
  if _, err := tea.NewProgram(&initialModel).Run(); err != nil {
      fmt.Fprintf(os.Stderr, "failed to start program: %v\\n", err)
  }
}
\`\`\`

The signature of the \`tea.NewProgram\` is

\`\`\`go
func NewProgram(model Model, opts ...ProgramOption) *Program
\`\`\`

where the interface \`Model\` is defined by:

[![](/assets/img/2025-03-09-02-54-45.png)](/assets/img/2025-03-09-02-54-45.png)

#### The Complete Start Method

As a spoiler, the complete \`Start()\` method will be like

\`\`\`go
func Start() {
	initialModel := ApplicationModel{
		Views: []View{
			NewProjectNameView(),
			NewMultiChoiceView(
				"Read configuration settings from:",
				[]string{
					"Command-line flas",
					"Environment variables",
				},
			),
			NewMultiChoiceView(
				"Pick your preferred router:",
				[]string{
					"Gorilla Mux",
					"HttpRouter",
				},
			),
		},
		CurrentViewIndex: 0,
		Progress:         progress.New(),
		ProgressChannel:  make(chan tea.Msg),
	}

	if _, err := tea.NewProgram(&initialModel).Run(); err != nil {
		fmt.Fprintf(os.Stderr, "failed to start program: %v\\n", err)
	}
}
\`\`\`

Let's first introduce our \`View\` interface:

#### View Interface

The \`Start\` method above has introduced \`View\` models, which is an interface of the form:

\`\`\`go
type View interface {
	View() string
	Update(msg tea.Msg, m *ApplicationModel) tea.Cmd
}
\`\`\`

\`View\` is essentially a simplified version of \`Model\`. The \`Update\` method slightly deviates from \`Model\`'s one as it accepts \`*ApplicationModel\` to get global state.

In the sequel we will define our \`ApplicationModel\` struct, which will implement \`Model\` interface and we embed all the necessary data into it.

Our \`ApplicationModel\` can be thought of as a \`View\` that contains many \`SubView\`'s, which are \`ProjectNameView\` and \`MultiChoiceView\` in our case.

### ApplicationModel Struct

\`\`\`go
type ApplicationModel struct {
  Views            []View
  CurrentViewIndex int
  CreateProject    bool
  Progress         progress.Model
  ProgressPercent  float64
  Quitting         bool
  ProgressChannel  chan tea.Msg
}
\`\`\`

#### The Imports

\`\`\`go
import (
	"fmt"
	"log"
	"os"
	"project_generator/internal/projgenerator"

	"github.com/charmbracelet/bubbles/progress"
	tea "github.com/charmbracelet/bubbletea"
)

\`\`\`

#### Implement Model Interface

##### Init

\`\`\`go
func (m *ApplicationModel) Init() tea.Cmd {
    return nil
}
\`\`\`

##### View

\`\`\`go
func (m *ApplicationModel) View() string {
	log.Println("Cli View() > m.CreateProject: ", m.CreateProject)
	if m.Quitting {
		return "See you later!"
	} else if m.CreateProject {

	}
	log.Println("Cli View() m.", m.CurrentViewIndex)
	log.Println("m.Views[m.CurrentViewIndex]", m.Views[m.CurrentViewIndex])
	var results string
	for index := 0; index <= m.CurrentViewIndex; index++ {
		results += m.Views[index].View() + "\\n"
	}
	return results
}
\`\`\`

- Here we concat **_all_** the view results. If we simply return \`m.Views[index].View()\`, the content of the previous view will disappear. This is not desirable, like if we have multiple choices, we wish to show the option chosen by the user.

- Although this \`View()\` method can be considered as a \`Render()\` method in browser, it is not triggered automatically in a regular time frame. This is triggered by the \`Update()\` method of the main \`View\`:

##### Update

We execute the \`Update\` method of the current selected view.

\`\`\`go
func (m *ApplicationModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	log.Println("cli update() msg:", msg)
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyEsc, tea.KeyCtrlC:
			return m, tea.Quit
		}

	case createProjectMsg:
		log.Println("Createing project")
		appConfig := populateAppConfig(m.Views)
		go projgenerator.GenerateProject(appConfig, m.ProgressChannel)
		return m, listenToProgress(m.ProgressChannel)
	}

	log.Println(" m.CurrentViewIndex < len(m.Views)", m.CurrentViewIndex < len(m.Views))
	if m.CurrentViewIndex < len(m.Views) {
		cmd = m.Views[m.CurrentViewIndex].Update(msg, m)
	}
	return m, cmd
}

\`\`\`

- Any key press in the CLI will send a \`tea.Msg\` object to the \`Update()\` method of the main. And we redirect this \`tea.Msg\` to the \`m.Views[m.CurrentViewIndex].Update(msg, m)\`

- We remark that we have introduced a custom \`createProjectMsg\` message type here, which is simply a struct defined by

  \`\`\`go
  type createProjectMsg struct {}
  \`\`\`

  Recall that our \`View\` model return \`tea.Cmd\` in any update, and this custom message type \`createProjectMsg\` is the return value of the following function:

  \`\`\`go
  func createProject() tea.Cmd {
    return tea.Tick(time.Second/60, func(t time.Time) tea.Msg {
      return createProjectMsg{}
    })
  }
  \`\`\`

  or simply

  \`\`\`go
  func createProject() tea.Cmd {
    return func() tea.Msg {
      return createProjectMsg{}
    }
  }
  \`\`\`

- Analogous to Redux, a \`tea.Cmd\` is like a \`ThunkAction\`, which is a function that returns \`{ action, payload }\` in the redux world. If necessary we can define payload inside of \`createProjectMsg\`.

### ProjectNameView

\`\`\`go
import (
	"fmt"
	"log"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type ProjectNameView struct {
	inputModel    textinput.Model
	endingMessage string
}

func NewProjectNameView() *ProjectNameView {
	inputModel := newTextInput("Project Name")
	return &ProjectNameView{
		inputModel:    inputModel,
		endingMessage: "",
	}
}

func newTextInput(prompt string) textinput.Model {
	ti := textinput.New()
	ti.Placeholder = prompt
	ti.Focus()
	ti.CharLimit = 156
	ti.Width = 20
	return ti
}

func (v *ProjectNameView) View() string {
	endingDisplay := func() string {
		if len(v.endingMessage) > 0 {
			return fmt.Sprintf("\\n\\nNice, the project name \\"%v\\" is well received.\\n\\n", v.inputModel.Value())
		}
		return ""
	}()
	return "Please input a project name: \\n\\n" + v.inputModel.View() + endingDisplay
}

func (v *ProjectNameView) Update(msg tea.Msg, m *ApplicationModel) tea.Cmd {
	log.Println("ProjectNameView.Update() > msg:", msg)

	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyEnter:
			v.endingMessage = v.inputModel.Value()
			m.CurrentViewIndex++
		}
	}
	v.inputModel, cmd = v.inputModel.Update(msg)
	return cmd
}
\`\`\`

### MultiChoiceView

\`\`\`go
import (
	"log"
	"math"
	"project_generator/internal/projgenerator"
	"project_generator/internal/termstyle"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

type MultiChoiceView struct {
	Prompt          string
	Options         []string
	Selected        int
}

func NewMultiChoiceView(prompt string, options []string) *MultiChoiceView {
	return &MultiChoiceView{
		Prompt:          prompt,
		Options:         options,
		Selected:        0,
	}
}

func (v *MultiChoiceView) View() string {
	log.Println("MultiChoiceView.View()")
	var builder strings.Builder
	builder.WriteString(v.Prompt + "\\n\\n")

	for index, option := range v.Options {
		checkbox := Checkbox(option, index == v.Selected)
		builder.WriteString(checkbox + "\\n")
	}

	instructions := termstyle.Subtle("enter:choose") + termstyle.Dot + termstyle.Subtle("esc or ctrl-c: quit")
	builder.WriteString("\\n" + instructions)

	return builder.String()
}

func (v *MultiChoiceView) Update(msg tea.Msg, m *ApplicationModel) tea.Cmd {
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyDown:
			v.Selected = int(math.Min(float64(v.Selected+1), float64(len(v.Options)-1)))
		case tea.KeyUp:
			v.Selected = int(math.Max(float64(v.Selected-1), float64(0)))
		case tea.KeyEnter:
			if m.CurrentViewIndex == len(m.Views)-1 {
				m.CreateProject = true
				log.Println("Return createProjectMsg")
				cmd = createProject()
			} else {
				m.CurrentViewIndex++
			}
		}
	}
	return cmd
}

func createProject() tea.Cmd {
	return tea.Tick(time.Second/60, func(time.Time) tea.Msg {
		return createProjectMsg{} // the type of msg used in update method.
	})
}
\`\`\`

### Termstyle

\`\`\`go
package termstyle

import (
	"fmt"
	"strconv"

	"github.com/charmbracelet/lipgloss"
	"github.com/lucasb-eyer/go-colorful"
	"github.com/muesli/termenv"
)

var (
	Term      = termenv.EnvColorProfile()
	Subtle    = makeFgStyle("241")
	Dot       = ColorFg(" • ", "236")
	HelpStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#626262")).Render
)

// Color a string's foreground with the given value.
func ColorFg(val, color string) string {
	return termenv.String(val).Foreground(Term.Color(color)).String()
}

// Return a function that will colorize the foreground of a given string.
func makeFgStyle(color string) func(string) string {
	return termenv.Style{}.Foreground(Term.Color(color)).Styled
}

// Generate a blend of colors.
func MakeRamp(colorA, colorB string, steps float64) (s []string) {
	cA, _ := colorful.Hex(colorA)
	cB, _ := colorful.Hex(colorB)

	for i := 0.0; i < steps; i++ {
		c := cA.BlendLuv(cB, i/steps)
		s = append(s, ColorToHex(c))
	}
	return
}

// Convert a colorful.Color to a hexadecimal format compatible with termenv.
func ColorToHex(c colorful.Color) string {
	return fmt.Sprintf("#%s%s%s", ColorFloatToHex(c.R), ColorFloatToHex(c.G), ColorFloatToHex(c.B))
}

// Helper function for converting colors to hex. Assumes a value between 0 and
// 1.
func ColorFloatToHex(f float64) (s string) {
	s = strconv.FormatInt(int64(f*255), 16)
	if len(s) == 1 {
		s = "0" + s
	}
	return
}
\`\`\`

### Entrypoint with Logging Setup

When executing our cli program there are not real-time log in our console. We need to log those information into another file:

\`\`\`go
package main

import (
	"log"
	"os"
	"project_generator/internal/cli"
)

const logFilePath = "project_creator.log"

var cleanup func() error

func init() {

	// Open or create the log file
	logFile, err := os.OpenFile(logFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatalf("error opening file: %v", err)
	}

	// Set log output to the file
	log.SetOutput(logFile)

	// Cleanup function to close the file
	cleanup = func() error {
		return logFile.Close()
	}
}

func main() {
	defer func() {
		if err := cleanup(); err != nil {
			log.Printf("Error during cleanup: %v\\n", err)
			os.Exit(1)
		}
	}()

	cli.Start()
}
\`\`\`
`;export{t as default};
