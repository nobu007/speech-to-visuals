/**
 * 🎓 Interactive Tutorial System
 * Comprehensive user onboarding and guidance for speech-to-visuals pipeline
 * Following custom instructions for user experience enhancement
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Play, FileAudio, Brain, Layout, Video, Lightbulb, ArrowRight, X } from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  component: string;
  duration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites?: string[];
  videoUrl?: string;
  interactiveDemo?: boolean;
}

interface TutorialCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  steps: TutorialStep[];
  estimatedTime: string;
}

export const TutorialSystem: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('overview');
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showTutorial, setShowTutorial] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(true);

  // Initialize tutorial state from localStorage
  useEffect(() => {
    const savedProgress = localStorage.getItem('tutorial-progress');
    const firstVisit = localStorage.getItem('first-visit');

    if (savedProgress) {
      setCompletedSteps(new Set(JSON.parse(savedProgress)));
    }

    if (firstVisit === null) {
      setShowTutorial(true);
      localStorage.setItem('first-visit', 'false');
    } else {
      setIsFirstVisit(false);
    }
  }, []);

  const tutorialCategories: TutorialCategory[] = [
    {
      id: 'overview',
      title: 'System Overview',
      description: 'Learn how the speech-to-visuals pipeline works',
      icon: <Lightbulb className="w-5 h-5" />,
      estimatedTime: '5 minutes',
      steps: [
        {
          id: 'overview-intro',
          title: 'Welcome to AutoDiagram Video Generator',
          description: 'Understand the core concept: transform speech into animated diagrams',
          component: 'Overview',
          duration: '2 min',
          difficulty: 'beginner'
        },
        {
          id: 'overview-pipeline',
          title: 'Pipeline Architecture',
          description: 'Audio → Transcript → Analysis → Diagrams → Video',
          component: 'Pipeline',
          duration: '3 min',
          difficulty: 'beginner'
        }
      ]
    },
    {
      id: 'audio-processing',
      title: 'Audio Processing',
      description: 'Upload and transcribe audio files',
      icon: <FileAudio className="w-5 h-5" />,
      estimatedTime: '8 minutes',
      steps: [
        {
          id: 'audio-upload',
          title: 'Audio Upload',
          description: 'Learn how to upload and prepare audio files',
          component: 'AudioUploader',
          duration: '3 min',
          difficulty: 'beginner'
        },
        {
          id: 'transcription-settings',
          title: 'Transcription Configuration',
          description: 'Configure Whisper models and language settings',
          component: 'Transcription',
          duration: '3 min',
          difficulty: 'intermediate'
        },
        {
          id: 'audio-preview',
          title: 'Audio Preview & Validation',
          description: 'Review transcription quality and make adjustments',
          component: 'Preview',
          duration: '2 min',
          difficulty: 'beginner'
        }
      ]
    },
    {
      id: 'content-analysis',
      title: 'Content Analysis',
      description: 'Understand how AI analyzes your content',
      icon: <Brain className="w-5 h-5" />,
      estimatedTime: '10 minutes',
      steps: [
        {
          id: 'scene-segmentation',
          title: 'Scene Segmentation',
          description: 'How the system breaks content into logical scenes',
          component: 'Analysis',
          duration: '4 min',
          difficulty: 'intermediate'
        },
        {
          id: 'diagram-detection',
          title: 'Diagram Type Detection',
          description: 'AI identifies the best diagram type for each scene',
          component: 'DiagramDetector',
          duration: '3 min',
          difficulty: 'intermediate'
        },
        {
          id: 'relationship-extraction',
          title: 'Relationship Extraction',
          description: 'Extracting connections and flows from speech',
          component: 'Relationships',
          duration: '3 min',
          difficulty: 'advanced'
        }
      ]
    },
    {
      id: 'visualization',
      title: 'Diagram Generation',
      description: 'Create beautiful, animated diagrams',
      icon: <Layout className="w-5 h-5" />,
      estimatedTime: '12 minutes',
      steps: [
        {
          id: 'layout-algorithms',
          title: 'Layout Algorithms',
          description: 'Choose the right layout for your content type',
          component: 'Layout',
          duration: '4 min',
          difficulty: 'intermediate'
        },
        {
          id: 'visual-styling',
          title: 'Visual Customization',
          description: 'Colors, themes, and visual enhancement options',
          component: 'VisualControl',
          duration: '4 min',
          difficulty: 'beginner'
        },
        {
          id: 'animation-timing',
          title: 'Animation & Timing',
          description: 'Control how elements appear and transition',
          component: 'Animation',
          duration: '4 min',
          difficulty: 'intermediate'
        }
      ]
    },
    {
      id: 'video-export',
      title: 'Video Generation',
      description: 'Export your final video with Remotion',
      icon: <Video className="w-5 h-5" />,
      estimatedTime: '6 minutes',
      steps: [
        {
          id: 'export-settings',
          title: 'Export Configuration',
          description: 'Choose resolution, format, and quality settings',
          component: 'Export',
          duration: '3 min',
          difficulty: 'beginner'
        },
        {
          id: 'remotion-rendering',
          title: 'Remotion Rendering',
          description: 'Understand the video generation process',
          component: 'Remotion',
          duration: '3 min',
          difficulty: 'intermediate'
        }
      ]
    }
  ];

  const saveProgress = (stepId: string) => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(stepId);
    setCompletedSteps(newCompleted);
    localStorage.setItem('tutorial-progress', JSON.stringify(Array.from(newCompleted)));
  };

  const getProgress = () => {
    const totalSteps = tutorialCategories.reduce((sum, cat) => sum + cat.steps.length, 0);
    return (completedSteps.size / totalSteps) * 100;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const TutorialStep: React.FC<{ step: TutorialStep }> = ({ step }) => {
    const isCompleted = completedSteps.has(step.id);

    return (
      <Card className={`cursor-pointer transition-all hover:shadow-md ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {isCompleted && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                <h4 className="font-medium">{step.title}</h4>
                <Badge className={getDifficultyColor(step.difficulty)}>
                  {step.difficulty}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-3">{step.description}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>⏱️ {step.duration}</span>
                <span>📍 {step.component}</span>
              </div>
            </div>
            <Button
              size="sm"
              variant={isCompleted ? "secondary" : "default"}
              onClick={() => {
                setActiveStep(step.id);
                if (!isCompleted) saveProgress(step.id);
              }}
            >
              {isCompleted ? 'Review' : 'Start'}
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const QuickStartGuide = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Quick Start (5 minutes)
        </CardTitle>
        <CardDescription>
          Get started immediately with these essential steps
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[
            { step: 1, title: 'Upload an audio file', component: 'AudioUploader' },
            { step: 2, title: 'Wait for transcription', component: 'ProcessingStatus' },
            { step: 3, title: 'Review generated diagrams', component: 'DiagramPreview' },
            { step: 4, title: 'Export your video', component: 'VideoRenderer' }
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-sm font-medium flex items-center justify-center">
                {item.step}
              </div>
              <span className="font-medium">{item.title}</span>
              <Badge variant="outline">{item.component}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      {/* Tutorial Trigger Button */}
      <Button
        onClick={() => setShowTutorial(true)}
        variant="outline"
        className="fixed bottom-4 right-4 z-50 shadow-lg"
      >
        🎓 Tutorials
      </Button>

      {/* Welcome Dialog for First-time Users */}
      <Dialog open={isFirstVisit && showTutorial} onOpenChange={setShowTutorial}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Welcome to AutoDiagram Video Generator! 🎉</DialogTitle>
            <DialogDescription className="text-base">
              Transform your audio recordings into stunning animated diagrams automatically.
              Would you like a quick tour of the system?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 my-4">
            <Card className="p-4">
              <h3 className="font-medium mb-2">🚀 Quick Start</h3>
              <p className="text-sm text-gray-600">Jump right in with a 5-minute overview</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-medium mb-2">📚 Full Tutorial</h3>
              <p className="text-sm text-gray-600">Complete guided tour of all features</p>
            </Card>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowTutorial(false)}>
              Skip for now
            </Button>
            <Button onClick={() => setActiveCategory('overview')}>
              Start Tutorial
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Tutorial Interface */}
      <Dialog open={showTutorial && !isFirstVisit} onOpenChange={setShowTutorial}>
        <DialogContent className="max-w-6xl h-[80vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">Tutorial System</DialogTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowTutorial(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Progress: {Math.round(getProgress())}%</span>
                <span>{completedSteps.size} / {tutorialCategories.reduce((sum, cat) => sum + cat.steps.length, 0)} steps completed</span>
              </div>
              <Progress value={getProgress()} className="h-2" />
            </div>
          </DialogHeader>

          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="h-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
              {tutorialCategories.map(category => (
                <TabsTrigger key={category.id} value={category.id} className="text-xs">
                  <span className="hidden sm:inline">{category.title}</span>
                  <span className="sm:hidden">{category.icon}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="quickstart" className="h-full overflow-y-auto">
              <QuickStartGuide />
            </TabsContent>

            {tutorialCategories.map(category => (
              <TabsContent key={category.id} value={category.id} className="h-full overflow-y-auto">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {category.icon}
                        {category.title}
                      </CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span>⏱️ {category.estimatedTime}</span>
                        <span>📝 {category.steps.length} steps</span>
                        <span>✅ {category.steps.filter(step => completedSteps.has(step.id)).length} completed</span>
                      </div>
                    </CardHeader>
                  </Card>

                  <div className="space-y-3">
                    {category.steps.map(step => (
                      <TutorialStep key={step.id} step={step} />
                    ))}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Individual Step Detail Modal */}
      {activeStep && (
        <Dialog open={!!activeStep} onOpenChange={() => setActiveStep(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Tutorial Step Details</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p>Detailed tutorial content for step: {activeStep}</p>
              {/* Here you would add specific tutorial content for each step */}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default TutorialSystem;