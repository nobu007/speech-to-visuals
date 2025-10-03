/**
 * 🎨 Professional Template UI Components
 * Iteration 37 - Phase 4: Template Selection Interface
 *
 * Beautiful template library interface with preview and customization
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Filter,
  Star,
  Eye,
  Download,
  Palette,
  Type,
  Layout,
  Sparkles,
  Building,
  Briefcase,
  GraduationCap,
  Stethoscope,
  DollarSign,
  Cog,
  Users,
  TrendingUp
} from 'lucide-react';

import {
  ProfessionalTemplateLibrary,
  DiagramTemplate,
  TemplateCategory,
  Industry,
  TemplateSearchFilters,
  TemplateCustomizations
} from './template-library';

interface TemplateLibraryProps {
  onTemplateSelect?: (template: DiagramTemplate, customizations?: TemplateCustomizations) => void;
  currentSceneData?: any;
  className?: string;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  onTemplateSelect,
  currentSceneData,
  className = ''
}) => {
  const [templateLibrary] = useState(() => new ProfessionalTemplateLibrary());
  const [templates, setTemplates] = useState<DiagramTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DiagramTemplate | null>(null);
  const [customizations, setCustomizations] = useState<TemplateCustomizations>({});
  const [searchFilters, setSearchFilters] = useState<TemplateSearchFilters>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load templates
  useEffect(() => {
    const loadTemplates = () => {
      const results = templateLibrary.searchTemplates(searchFilters);
      setTemplates(results);
      setIsLoading(false);
    };

    loadTemplates();
  }, [templateLibrary, searchFilters]);

  const handleSearch = (query: string) => {
    setSearchFilters(prev => ({ ...prev, query }));
  };

  const handleFilterChange = (filters: Partial<TemplateSearchFilters>) => {
    setSearchFilters(prev => ({ ...prev, ...filters }));
  };

  const handleTemplateSelect = (template: DiagramTemplate) => {
    setSelectedTemplate(template);
  };

  const handleApplyTemplate = () => {
    if (selectedTemplate && onTemplateSelect) {
      onTemplateSelect(selectedTemplate, customizations);
    }
  };

  const categoryIcons: { [key in TemplateCategory]: React.ComponentType<any> } = {
    'business-process': Briefcase,
    'organizational': Users,
    'technical-flow': Cog,
    'educational': GraduationCap,
    'presentation': TrendingUp,
    'marketing': Sparkles,
    'scientific': Eye,
    'creative': Palette
  };

  const industryIcons: { [key in Industry]: React.ComponentType<any> } = {
    'technology': Cog,
    'healthcare': Stethoscope,
    'finance': DollarSign,
    'education': GraduationCap,
    'manufacturing': Building,
    'consulting': Briefcase,
    'marketing': TrendingUp,
    'nonprofit': Users,
    'government': Building,
    'general': Star
  };

  return (
    <div className={`flex gap-6 h-full ${className}`}>
      {/* Template Browser */}
      <div className=\"flex-1 space-y-4\">
        {/* Search and Filters */}
        <Card>
          <CardHeader className=\"pb-3\">
            <CardTitle className=\"flex items-center gap-2\">
              <Palette className=\"h-5 w-5\" />
              Template Library
              <Badge variant=\"secondary\" className=\"ml-auto\">
                {templates.length} templates
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className=\"space-y-4\">
            {/* Search Bar */}
            <div className=\"relative\">
              <Search className=\"absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground\" />
              <Input
                placeholder=\"Search templates...\"
                className=\"pl-10\"
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className=\"flex gap-3 flex-wrap\">
              <Select onValueChange={(value) => handleFilterChange({ category: value as TemplateCategory })}>
                <SelectTrigger className=\"w-40\">
                  <SelectValue placeholder=\"Category\" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=\"business-process\">Business Process</SelectItem>
                  <SelectItem value=\"organizational\">Organizational</SelectItem>
                  <SelectItem value=\"technical-flow\">Technical Flow</SelectItem>
                  <SelectItem value=\"educational\">Educational</SelectItem>
                  <SelectItem value=\"presentation\">Presentation</SelectItem>
                  <SelectItem value=\"marketing\">Marketing</SelectItem>
                  <SelectItem value=\"scientific\">Scientific</SelectItem>
                  <SelectItem value=\"creative\">Creative</SelectItem>
                </SelectContent>
              </Select>

              <Select onValueChange={(value) => handleFilterChange({ industry: value as Industry })}>
                <SelectTrigger className=\"w-40\">
                  <SelectValue placeholder=\"Industry\" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=\"technology\">Technology</SelectItem>
                  <SelectItem value=\"healthcare\">Healthcare</SelectItem>
                  <SelectItem value=\"finance\">Finance</SelectItem>
                  <SelectItem value=\"education\">Education</SelectItem>
                  <SelectItem value=\"manufacturing\">Manufacturing</SelectItem>
                  <SelectItem value=\"consulting\">Consulting</SelectItem>
                  <SelectItem value=\"marketing\">Marketing</SelectItem>
                  <SelectItem value=\"nonprofit\">Non-profit</SelectItem>
                  <SelectItem value=\"government\">Government</SelectItem>
                  <SelectItem value=\"general\">General</SelectItem>
                </SelectContent>
              </Select>

              <Select onValueChange={(value) => handleFilterChange({ sortBy: value })}>
                <SelectTrigger className=\"w-32\">
                  <SelectValue placeholder=\"Sort by\" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=\"rating\">Rating</SelectItem>
                  <SelectItem value=\"usage\">Usage</SelectItem>
                  <SelectItem value=\"updated\">Updated</SelectItem>
                  <SelectItem value=\"name\">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Template Grid */}
        <ScrollArea className=\"h-[600px]\">
          <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4\">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedTemplate?.id === template.id}
                onSelect={() => handleTemplateSelect(template)}
                categoryIcon={categoryIcons[template.category]}
                industryIcon={industryIcons[template.industry]}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Template Preview and Customization */}
      {selectedTemplate && (
        <div className=\"w-96 space-y-4\">
          <TemplatePreview
            template={selectedTemplate}
            customizations={customizations}
            onCustomizationChange={setCustomizations}
            onApplyTemplate={handleApplyTemplate}
          />
        </div>
      )}
    </div>
  );
};

interface TemplateCardProps {
  template: DiagramTemplate;
  isSelected: boolean;
  onSelect: () => void;
  categoryIcon: React.ComponentType<any>;
  industryIcon: React.ComponentType<any>;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  isSelected,
  onSelect,
  categoryIcon: CategoryIcon,
  industryIcon: IndustryIcon
}) => {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
      }`}
      onClick={onSelect}
    >
      {/* Template Preview */}
      <div className=\"aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative overflow-hidden\">
        <div className=\"absolute inset-4 border-2 border-dashed border-primary/20 rounded-lg flex items-center justify-center\">
          <CategoryIcon className=\"h-8 w-8 text-primary/40\" />
        </div>

        {/* Complexity Badge */}
        <Badge
          variant={template.metadata.complexity === 'simple' ? 'secondary' :
                  template.metadata.complexity === 'moderate' ? 'default' : 'destructive'}
          className=\"absolute top-2 right-2\"
        >
          {template.metadata.complexity}
        </Badge>
      </div>

      <CardContent className=\"p-4 space-y-3\">
        {/* Template Info */}
        <div>
          <h3 className=\"font-medium text-sm leading-tight\">{template.name}</h3>
          <p className=\"text-xs text-muted-foreground mt-1 line-clamp-2\">
            {template.description}
          </p>
        </div>

        {/* Categories and Industry */}
        <div className=\"flex items-center gap-2 text-xs\">
          <div className=\"flex items-center gap-1 text-muted-foreground\">
            <CategoryIcon className=\"h-3 w-3\" />
            <span className=\"capitalize\">{template.category.replace('-', ' ')}</span>
          </div>
          <Separator orientation=\"vertical\" className=\"h-3\" />
          <div className=\"flex items-center gap-1 text-muted-foreground\">
            <IndustryIcon className=\"h-3 w-3\" />
            <span className=\"capitalize\">{template.industry}</span>
          </div>
        </div>

        {/* Rating and Usage */}
        <div className=\"flex items-center justify-between text-xs\">
          <div className=\"flex items-center gap-1\">
            <Star className=\"h-3 w-3 fill-yellow-400 text-yellow-400\" />
            <span>{template.metadata.rating?.toFixed(1) || 'N/A'}</span>
          </div>
          <div className=\"flex items-center gap-1 text-muted-foreground\">
            <Download className=\"h-3 w-3\" />
            <span>{template.metadata.usageCount || 0}</span>
          </div>
        </div>

        {/* Tags */}
        <div className=\"flex gap-1 flex-wrap\">
          {template.metadata.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant=\"outline\" className=\"text-xs px-1 py-0\">
              {tag}
            </Badge>
          ))}
          {template.metadata.tags.length > 3 && (
            <Badge variant=\"outline\" className=\"text-xs px-1 py-0\">
              +{template.metadata.tags.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface TemplatePreviewProps {
  template: DiagramTemplate;
  customizations: TemplateCustomizations;
  onCustomizationChange: (customizations: TemplateCustomizations) => void;
  onApplyTemplate: () => void;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  customizations,
  onCustomizationChange,
  onApplyTemplate
}) => {
  return (
    <Card className=\"h-full\">
      <CardHeader className=\"pb-3\">
        <CardTitle className=\"flex items-center gap-2 text-lg\">
          <Eye className=\"h-5 w-5\" />
          Preview & Customize
        </CardTitle>
      </CardHeader>

      <CardContent className=\"space-y-4\">
        {/* Template Info */}
        <div className=\"space-y-2\">
          <h3 className=\"font-medium\">{template.name}</h3>
          <p className=\"text-sm text-muted-foreground\">{template.description}</p>

          <div className=\"flex items-center gap-2 text-xs\">
            <Badge variant=\"secondary\">{template.category.replace('-', ' ')}</Badge>
            <Badge variant=\"outline\">{template.industry}</Badge>
            <Badge variant={template.metadata.complexity === 'simple' ? 'secondary' : 'default'}>
              {template.metadata.complexity}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Preview */}
        <div className=\"space-y-3\">
          <h4 className=\"font-medium text-sm\">Preview</h4>
          <div className=\"aspect-video bg-gradient-to-br from-muted/50 to-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center\">
            <div className=\"text-center text-muted-foreground\">
              <Layout className=\"h-8 w-8 mx-auto mb-2\" />
              <div className=\"text-sm\">Template Preview</div>
              <div className=\"text-xs\">{template.layout.type} layout</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Customization Options */}
        <Tabs defaultValue=\"colors\" className=\"w-full\">
          <TabsList className=\"grid w-full grid-cols-3\">
            <TabsTrigger value=\"colors\">Colors</TabsTrigger>
            <TabsTrigger value=\"typography\">Type</TabsTrigger>
            <TabsTrigger value=\"layout\">Layout</TabsTrigger>
          </TabsList>

          <TabsContent value=\"colors\" className=\"space-y-3 mt-4\">
            <h4 className=\"font-medium text-sm flex items-center gap-2\">
              <Palette className=\"h-4 w-4\" />
              Color Scheme
            </h4>

            {/* Color Presets */}
            <div className=\"space-y-2\">
              {template.customization.presets.map((preset) => (
                <Button
                  key={preset.name}
                  variant=\"outline\"
                  size=\"sm\"
                  className=\"w-full justify-start\"
                  onClick={() => onCustomizationChange({
                    ...customizations,
                    colors: preset.changes.colors
                  })}
                >
                  <div className=\"flex items-center gap-2\">
                    <div className=\"flex gap-1\">
                      {preset.changes.colors?.primary?.slice(0, 3).map((color, i) => (
                        <div
                          key={i}
                          className=\"w-3 h-3 rounded-full border\"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span>{preset.name}</span>
                  </div>
                </Button>
              ))}
            </div>

            {/* Primary Colors */}
            <div className=\"space-y-2\">
              <Label className=\"text-xs\">Primary Colors</Label>
              <div className=\"grid grid-cols-5 gap-2\">
                {template.style.colorPalette.primary.map((color, index) => (
                  <div
                    key={index}
                    className=\"aspect-square rounded border-2 border-muted cursor-pointer hover:border-primary transition-colors\"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value=\"typography\" className=\"space-y-3 mt-4\">
            <h4 className=\"font-medium text-sm flex items-center gap-2\">
              <Type className=\"h-4 w-4\" />
              Typography
            </h4>

            <div className=\"space-y-3 text-sm\">
              <div>
                <Label className=\"text-xs\">Heading Font</Label>
                <div className=\"font-medium\" style={{ fontFamily: template.style.typography.fontFamilies.heading }}>
                  {template.style.typography.fontFamilies.heading}
                </div>
              </div>

              <div>
                <Label className=\"text-xs\">Body Font</Label>
                <div style={{ fontFamily: template.style.typography.fontFamilies.body }}>
                  {template.style.typography.fontFamilies.body}
                </div>
              </div>

              {/* Font Size Preview */}
              <div className=\"space-y-1\">
                <div style={{ fontSize: template.style.typography.fontSizes.title }}>Title Size</div>
                <div style={{ fontSize: template.style.typography.fontSizes.heading }}>Heading Size</div>
                <div style={{ fontSize: template.style.typography.fontSizes.body }}>Body Size</div>
                <div style={{ fontSize: template.style.typography.fontSizes.caption }}>Caption Size</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value=\"layout\" className=\"space-y-3 mt-4\">
            <h4 className=\"font-medium text-sm flex items-center gap-2\">
              <Layout className=\"h-4 w-4\" />
              Layout Settings
            </h4>

            <div className=\"space-y-3 text-sm\">
              <div className=\"flex justify-between items-center\">
                <Label>Layout Type</Label>
                <Badge variant=\"outline\">{template.layout.type}</Badge>
              </div>

              <div className=\"flex justify-between items-center\">
                <Label>Node Shape</Label>
                <Badge variant=\"outline\">{template.layout.nodeStyles.shape}</Badge>
              </div>

              <div className=\"flex justify-between items-center\">
                <Label>Edge Style</Label>
                <Badge variant=\"outline\">{template.layout.edgeStyles.type}</Badge>
              </div>

              <div className=\"flex justify-between items-center\">
                <Label>Spacing</Label>
                <span className=\"text-muted-foreground\">{template.layout.spacing.nodeGap}px</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Template Stats */}
        <div className=\"space-y-2 text-xs text-muted-foreground\">
          <div className=\"flex justify-between\">
            <span>Version</span>
            <span>{template.metadata.version}</span>
          </div>
          <div className=\"flex justify-between\">
            <span>Author</span>
            <span>{template.metadata.author}</span>
          </div>
          <div className=\"flex justify-between\">
            <span>Last Updated</span>
            <span>{template.metadata.lastUpdated.toLocaleDateString()}</span>
          </div>
        </div>

        {/* Apply Button */}
        <Button onClick={onApplyTemplate} className=\"w-full\" size=\"lg\">
          <Sparkles className=\"h-4 w-4 mr-2\" />
          Apply Template
        </Button>
      </CardContent>
    </Card>
  );
};