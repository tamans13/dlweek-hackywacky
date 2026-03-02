import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";


export default function OnboardingWelcome() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    university: "",
    course: "",
    year: "",
  });

  const handleContinue = () => {
    sessionStorage.setItem("onboarding_welcome", JSON.stringify(formData));
    navigate("/onboarding/permissions");
  };

  const canContinue =
    Boolean(formData.email.trim()) &&
    Boolean(formData.password.trim()) &&
    formData.password.trim().length >= 6 &&
    Boolean(formData.university.trim()) &&
    Boolean(formData.course.trim()) &&
    Boolean(formData.year.trim());

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="text-center space-y-8 py-8">
        <div className="flex justify-center">
          <div className="w-48 h-48 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center">
            <video
              src="/Brainosaur.mp4"
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="text-5xl font-medium text-foreground">
            Understand How You Learn.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered analytics that model your evolving learning state to help you study smarter.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-card border border-border rounded-lg p-8 max-w-md mx-auto space-y-6">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            placeholder="your full name"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="bg-input-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="your email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="bg-input-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="bg-input-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="university">School</Label>
          <Input
            id="university"
            placeholder="e.g., National University of Singapore"
            value={formData.university}
            onChange={(e) => setFormData({ ...formData, university: e.target.value })}
            className="bg-input-background"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="course">Course</Label>
            <Input
              id="course"
              placeholder="e.g., Economics"
              value={formData.course}
              onChange={(e) => setFormData({ ...formData, course: e.target.value })}
              className="bg-input-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              placeholder="e.g., 2"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              className="bg-input-background"
            />
          </div>
        </div>
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg"
        >
          Create My Learning System
        </Button>
        <p className="text-xs text-muted-foreground">
          Use the same email/password next time to access your saved modules, documents, and quiz history.
        </p>
        <p className="text-xs text-muted-foreground text-center">
          Returning user?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in here
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
